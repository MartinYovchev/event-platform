package com.example.booking_service.booking.reservation;

import com.example.booking_service.booking.event.Event;
import com.example.booking_service.booking.event.EventRepository;
import com.example.booking_service.booking.event.EventService;
import com.example.booking_service.booking.event.EventStatus;
import com.example.booking_service.booking.messaging.ReservationConfirmedEvent;
import com.example.booking_service.booking.messaging.ReservationEventPublisher;
import com.example.booking_service.booking.payment.CheckoutRequest;
import com.example.booking_service.booking.payment.PaymentClient;
import com.example.booking_service.booking.reservation.dto.CreateReservationRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
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
    private final CheckInTokenService checkInTokenService;
    private final ReservationEventPublisher reservationEventPublisher;
    private final TransactionTemplate tx;
    private final TransactionTemplate readOnlyTx;
    private final String currency;

    public record ReserveResult(Reservation reservation, String checkoutUrl) {}

    public ReservationService(ReservationRepository reservationRepository,
                              EventRepository eventRepository,
                              PaymentClient paymentClient,
                              CheckInTokenService checkInTokenService,
                              ReservationEventPublisher reservationEventPublisher,
                              PlatformTransactionManager txManager,
                              @Value("${app.currency:eur}") String currency) {
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.paymentClient = paymentClient;
        this.checkInTokenService = checkInTokenService;
        this.reservationEventPublisher = reservationEventPublisher;
        this.tx = new TransactionTemplate(txManager);
        this.readOnlyTx = new TransactionTemplate(txManager);
        this.readOnlyTx.setReadOnly(true);
        this.currency = currency;
    }

    private record HoldOutcome(boolean free, Reservation reservation, ReservationConfirmedEvent confirmedEvent,
                               Long reservationId, String eventTitle, long amountMinor) {}

    public ReserveResult reserve(Long userId, String userEmail, String userName, Long eventId, CreateReservationRequest req) {
        HoldOutcome outcome = tx.execute(status -> doHold(userId, userEmail, userName, eventId, req));
        if (outcome.free()) {
            // Free events are ACTIVE immediately — notify after the hold transaction has committed.
            reservationEventPublisher.publishConfirmed(outcome.confirmedEvent());
            return new ReserveResult(outcome.reservation(), null);
        }

        try {
            String checkoutUrl = paymentClient.createCheckout(new CheckoutRequest(
                    outcome.reservationId(), outcome.eventTitle(),
                    outcome.amountMinor(), currency, userEmail));
            return new ReserveResult(outcome.reservation(), checkoutUrl);
        } catch (Exception ex) {
            tx.executeWithoutResult(status -> releasePendingInternal(outcome.reservationId()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not start payment");
        }
    }

    private HoldOutcome doHold(Long userId, String userEmail, String userName, Long eventId, CreateReservationRequest req) {
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
                    .map(existing -> {
                        existing.setQuantity(existing.getQuantity() + req.quantity());
                        existing.setUserEmail(userEmail);
                        existing.setUserName(userName);
                        return existing;
                    })
                    .orElseGet(() -> {
                        Reservation nr = new Reservation();
                        nr.setUserId(userId);
                        nr.setEvent(event);
                        nr.setQuantity(req.quantity());
                        nr.setStatus(ReservationStatus.ACTIVE);
                        nr.setUserEmail(userEmail);
                        nr.setUserName(userName);
                        return reservationRepository.save(nr);
                    });
            return new HoldOutcome(true, r, buildConfirmedEvent(r), r.getId(), event.getTitle(), 0L);
        }

        reservationRepository.findByUserIdAndEventAndStatus(userId, event, ReservationStatus.PENDING)
                .ifPresent(this::releaseHeldReservation);
        if (reservationRepository.findByUserIdAndEventAndStatus(userId, event, ReservationStatus.ACTIVE).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a ticket for this event");

        int updated = eventRepository.adjustSeats(eventId, req.quantity());
        if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");

        Reservation r = new Reservation();
        r.setUserId(userId); r.setEvent(event);
        r.setQuantity(req.quantity()); r.setStatus(ReservationStatus.PENDING);
        r.setUserEmail(userEmail); r.setUserName(userName);
        r = reservationRepository.save(r);

        long amountMinor = event.getPrice().movePointRight(2).longValueExact() * req.quantity();
        return new HoldOutcome(false, r, null, r.getId(), event.getTitle(), amountMinor);
    }

    /** Build the confirmation event (mints the signed QR token) from a committed-state reservation. */
    private ReservationConfirmedEvent buildConfirmedEvent(Reservation r) {
        Event e = r.getEvent();
        return new ReservationConfirmedEvent(
                r.getId(), e.getId(), e.getTitle(), e.getLocation(), e.getStartAt(),
                r.getQuantity(), r.getUserEmail(), r.getUserName(), checkInTokenService.mint(r));
    }

    public void confirmPayment(Long reservationId) {
        // Build the confirmation event inside the tx (only on a real PENDING->ACTIVE transition),
        // then publish after commit so the email reflects committed state and we never double-send.
        ReservationConfirmedEvent event = tx.execute(status ->
                reservationRepository.findById(reservationId)
                        .filter(r -> r.getStatus() == ReservationStatus.PENDING)
                        .map(r -> {
                            r.setStatus(ReservationStatus.ACTIVE);
                            return buildConfirmedEvent(r);
                        })
                        .orElse(null));
        if (event != null) {
            reservationEventPublisher.publishConfirmed(event);
        }
    }

    public record CheckInView(Long reservationId, Long eventId, String name, String email,
                              Integer quantity, boolean attended, Instant checkedInAt) {}

    /** Read-only step 1: validate the scan and return the attendee's identity (no mutation). */
    public CheckInView previewCheckIn(Long organizerUid, Long eventId, Long reservationId) {
        return readOnlyTx.execute(status -> toView(loadValidForCheckIn(organizerUid, eventId, reservationId)));
    }

    /** Step 2: re-validate then mark the reservation as attended. */
    public CheckInView confirmCheckIn(Long organizerUid, Long eventId, Long reservationId) {
        return tx.execute(status -> {
            Reservation r = loadValidForCheckIn(organizerUid, eventId, reservationId);
            if (r.isAttended()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Already checked in at " + r.getCheckedInAt());
            }
            r.setAttended(true);
            r.setCheckedInAt(Instant.now());
            return toView(r);
        });
    }

    private Reservation loadValidForCheckIn(Long organizerUid, Long eventId, Long reservationId) {
        Reservation r = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
        Event e = r.getEvent();
        if (!e.getId().equals(eventId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token does not match this event");
        }
        if (!e.getOrganizerId().equals(organizerUid)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your event");
        }
        if (r.getStatus() != ReservationStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Reservation is not active");
        }
        return r;
    }

    private CheckInView toView(Reservation r) {
        return new CheckInView(r.getId(), r.getEvent().getId(), r.getUserName(), r.getUserEmail(),
                r.getQuantity(), r.isAttended(), r.getCheckedInAt());
    }

    public void releasePending(Long reservationId) {
        tx.executeWithoutResult(status -> releasePendingInternal(reservationId));
    }

    private void releasePendingInternal(Long reservationId) {
        reservationRepository.findById(reservationId).ifPresent(this::releaseHeldReservation);
    }

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

            eventRepository.adjustSeats(e.getId(), -r.getQuantity());
            r.setStatus(ReservationStatus.CANCELLED);
            return r;
        });
    }

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

    public Page<Reservation> listMine(Long userId, String when, int page, int size) {
        boolean upcoming = "upcoming".equalsIgnoreCase(when);
        return readOnlyTx.execute(status ->
                reservationRepository.findMine(userId, upcoming, Instant.now(), PageRequest.of(page, size)));
    }

    public static Long requireUid(Jwt jwt) {
        return EventService.requireUid(jwt);
    }
}
