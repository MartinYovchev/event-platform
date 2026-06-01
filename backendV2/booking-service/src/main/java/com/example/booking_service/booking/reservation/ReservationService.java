package com.example.booking_service.booking.reservation;

import com.example.booking_service.booking.event.Event;
import com.example.booking_service.booking.event.EventRepository;
import com.example.booking_service.booking.event.EventStatus;
import com.example.booking_service.booking.payment.CheckoutRequest;
import com.example.booking_service.booking.payment.PaymentClient;
import com.example.booking_service.booking.reservation.dto.CreateReservationRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final PaymentClient paymentClient;
    private final TransactionTemplate tx;
    private final TransactionTemplate readOnlyTx;
    private final String currency;

    public record ReserveResult(Reservation reservation, String checkoutUrl) {}

    public ReservationService(ReservationRepository reservationRepository,
                              EventRepository eventRepository,
                              PaymentClient paymentClient,
                              PlatformTransactionManager txManager,
                              @Value("${app.currency:eur}") String currency) {
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.paymentClient = paymentClient;
        this.tx = new TransactionTemplate(txManager);
        this.readOnlyTx = new TransactionTemplate(txManager);
        this.readOnlyTx.setReadOnly(true);
        this.currency = currency;
    }

    // Outcome of the seat-hold phase. For free events the reservation is already ACTIVE.
    // For paid events it is PENDING and we still owe a checkout call.
    private record HoldOutcome(boolean free, Reservation reservation,
                               Long reservationId, String eventTitle, long amountMinor) {}

    public ReserveResult reserve(Long userId, String userEmail, Long eventId, CreateReservationRequest req) {
        // Phase 1 — validate + hold seats inside a single short transaction.
        HoldOutcome outcome = tx.execute(status -> doHold(userId, eventId, req));
        System.out.println(outcome);
        if (outcome.free()) {
            return new ReserveResult(outcome.reservation(), null);
        }

        // Phase 2 — remote checkout, no DB transaction held across the network call.
        try {
            String checkoutUrl = paymentClient.createCheckout(new CheckoutRequest(
                    outcome.reservationId(), outcome.eventTitle(),
                    outcome.amountMinor(), currency, userEmail));
            return new ReserveResult(outcome.reservation(), checkoutUrl);
        } catch (Exception ex) {
            // Compensate: release the held seats and cancel the PENDING reservation.
            tx.executeWithoutResult(status -> releasePendingInternal(outcome.reservationId()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not start payment");
        }
    }

    private HoldOutcome doHold(Long userId, Long eventId, CreateReservationRequest req) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (event.getStatus() != EventStatus.PUBLISHED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is not PUBLISHED");
        if (event.getStartAt().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event already started");

        boolean free = event.getPrice().compareTo(BigDecimal.ZERO) == 0;

        if (free) {
            int updated = eventRepository.adjustSeats(eventId, req.quantity());
            if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");
            Reservation r = reservationRepository
                    .findByUserIdAndEventAndStatus(userId, event, ReservationStatus.ACTIVE)
                    .map(existing -> { existing.setQuantity(existing.getQuantity() + req.quantity()); return existing; })
                    .orElseGet(() -> {
                        Reservation nr = new Reservation();
                        nr.setUserId(userId); nr.setEvent(event);
                        nr.setQuantity(req.quantity()); nr.setStatus(ReservationStatus.ACTIVE);
                        return reservationRepository.save(nr);
                    });
            return new HoldOutcome(true, r, r.getId(), event.getTitle(), 0L);
        }

        // Paid: clear any stale hold for this user/event so retries don't stack.
        reservationRepository.findByUserIdAndEventAndStatus(userId, event, ReservationStatus.PENDING)
                .ifPresent(this::releaseHeldReservation);
        if (reservationRepository.findByUserIdAndEventAndStatus(userId, event, ReservationStatus.ACTIVE).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a ticket for this event");

        int updated = eventRepository.adjustSeats(eventId, req.quantity());
        if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");

        Reservation r = new Reservation();
        r.setUserId(userId); r.setEvent(event);
        r.setQuantity(req.quantity()); r.setStatus(ReservationStatus.PENDING);
        r = reservationRepository.save(r);

        long amountMinor = event.getPrice().movePointRight(2).longValueExact() * req.quantity();
        return new HoldOutcome(false, r, r.getId(), event.getTitle(), amountMinor);
    }

    /** PaymentConfirmed consumer: a PENDING hold becomes ACTIVE. Seats already held. Idempotent. */
    public void confirmPayment(Long reservationId) {
        tx.executeWithoutResult(status ->
                reservationRepository.findById(reservationId).ifPresent(r -> {
                    if (r.getStatus() == ReservationStatus.PENDING) {
                        r.setStatus(ReservationStatus.ACTIVE);
                    }
                }));
    }

    /** PaymentExpired consumer (and saga compensation): release a PENDING hold. Idempotent. */
    public void releasePending(Long reservationId) {
        tx.executeWithoutResult(status -> releasePendingInternal(reservationId));
    }

    private void releasePendingInternal(Long reservationId) {
        reservationRepository.findById(reservationId).ifPresent(this::releaseHeldReservation);
    }

    // Release seats for a PENDING reservation and cancel it. Must run inside a transaction.
    private void releaseHeldReservation(Reservation r) {
        if (r.getStatus() != ReservationStatus.PENDING) return;
        eventRepository.adjustSeats(r.getEvent().getId(), -r.getQuantity());
        r.setStatus(ReservationStatus.CANCELLED);
    }

    public Reservation cancel(Long userId, Long reservationId) {
        return tx.execute(status -> {
            Reservation r = reservationRepository.findById(reservationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (!r.getUserId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            if (r.getStatus() != ReservationStatus.ACTIVE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");
            }
            Event e = r.getEvent();
            Instant cutoff = e.getStartAt().minusSeconds(e.getCancellationCutoffHours() * 3600L);
            if (Instant.now().isAfter(cutoff)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Past cancellation cutoff");
            }
            // Release seats. If the event was concurrently cancelled, adjustSeats returns 0
            // (status != PUBLISHED) — fine; the cascade already zeroed seats_taken.
            eventRepository.adjustSeats(e.getId(), -r.getQuantity());
            r.setStatus(ReservationStatus.CANCELLED);
            return r;
        });
    }

    /** UserDeleted consumer: cancel all of a user's live reservations, releasing their seats. */
    public void cancelAllForUser(Long userId) {
        tx.executeWithoutResult(status -> {
            List<Reservation> live = reservationRepository.findAllByUserIdAndStatusIn(
                    userId, List.of(ReservationStatus.ACTIVE, ReservationStatus.PENDING));
            for (Reservation r : live) {
                eventRepository.adjustSeats(r.getEvent().getId(), -r.getQuantity());
                r.setStatus(ReservationStatus.CANCELLED);
            }
        });
    }

    public Page<Reservation> listMine(Long userId, boolean upcoming, int page, int size) {
        return readOnlyTx.execute(status ->
                reservationRepository.findMine(userId, upcoming, Instant.now(), PageRequest.of(page, size)));
    }
}
