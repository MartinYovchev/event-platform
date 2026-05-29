package com.example.backend.reservation;

import com.example.backend.event.Event;
import com.example.backend.event.EventRepository;
import com.example.backend.event.EventStatus;
import com.example.backend.payment.StripeService;
import com.example.backend.reservation.dto.CreateReservationRequest;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import com.stripe.model.checkout.Session;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final StripeService stripeService;
    public record ReserveResult(Reservation reservation, String checkoutUrl) {}

    public ReservationService(ReservationRepository reservationRepository,
                              EventRepository eventRepository,
                              UserRepository userRepository,
                              StripeService stripeService) {
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.stripeService = stripeService;
    }


    @Transactional
    public ReserveResult reserve(String callerEmail, Long eventId, CreateReservationRequest req) {
        User user = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (event.getStatus() != EventStatus.PUBLISHED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is not PUBLISHED");
        if (event.getStartAt().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event already started");

        boolean free = event.getPrice().compareTo(java.math.BigDecimal.ZERO) == 0;

        if (free) {
            int updated = eventRepository.adjustSeats(eventId, req.quantity());
            if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");
            Reservation r = reservationRepository
                    .findByUserAndEventAndStatus(user, event, ReservationStatus.ACTIVE)
                    .map(existing -> { existing.setQuantity(existing.getQuantity() + req.quantity()); return existing; })
                    .orElseGet(() -> {
                        Reservation nr = new Reservation();
                        nr.setUser(user); nr.setEvent(event);
                        nr.setQuantity(req.quantity()); nr.setStatus(ReservationStatus.ACTIVE);
                        return reservationRepository.save(nr);
                    });
            return new ReserveResult(r, null);
        }

        // Paid: clear any stale hold for this user/event so retries don't stack.
        reservationRepository.findByUserAndEventAndStatus(user, event, ReservationStatus.PENDING)
                .ifPresent(this::releasePending);
        if (reservationRepository.findByUserAndEventAndStatus(user, event, ReservationStatus.ACTIVE).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a ticket for this event");

        int updated = eventRepository.adjustSeats(eventId, req.quantity());
        if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");

        Reservation r = new Reservation();
        r.setUser(user); r.setEvent(event);
        r.setQuantity(req.quantity()); r.setStatus(ReservationStatus.PENDING);
        r = reservationRepository.save(r);

        Session session = stripeService.createCheckoutSession(r, event, req.quantity(), user.getEmail());
        r.setStripeSessionId(session.getId());
        return new ReserveResult(r, session.getUrl());
    }

    @Transactional
    public void confirmPayment(String sessionId, String paymentIntentId) {
        reservationRepository.findByStripeSessionId(sessionId).ifPresent(r -> {
            if (r.getStatus() == ReservationStatus.PENDING) {     // idempotent
                r.setStatus(ReservationStatus.ACTIVE);
                r.setStripePaymentIntentId(paymentIntentId);
                r.setPaidAt(Instant.now());
                // seats already held — no adjustSeats here
            }
        });
    }

    @Transactional
    public void releasePendingBySession(String sessionId) {
        reservationRepository.findByStripeSessionId(sessionId)
                .ifPresent(this::releasePending);
    }

    private void releasePending(Reservation r) {
        if (r.getStatus() != ReservationStatus.PENDING) return;
        eventRepository.adjustSeats(r.getEvent().getId(), -r.getQuantity());
        r.setStatus(ReservationStatus.CANCELLED);
    }

    @Transactional
    public Reservation cancel(String callerEmail, Long reservationId) {
        Reservation r = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!r.getUser().getEmail().equals(callerEmail)) {
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
        // (status != PUBLISHED) — that's fine; the cascade already zeroed seats_taken.
        eventRepository.adjustSeats(e.getId(), -r.getQuantity());
        r.setStatus(ReservationStatus.CANCELLED);
        return r;
    }

    @Transactional(readOnly = true)
    public Page<Reservation> listMine(String callerEmail, boolean upcoming, int page, int size) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(callerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return reservationRepository.findMine(user, upcoming, Instant.now(), PageRequest.of(page, size));
    }
}
