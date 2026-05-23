package com.example.backend.reservation;

import com.example.backend.event.Event;
import com.example.backend.event.EventRepository;
import com.example.backend.event.EventStatus;
import com.example.backend.reservation.dto.CreateReservationRequest;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
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

    public ReservationService(ReservationRepository reservationRepository,
                              EventRepository eventRepository,
                              UserRepository userRepository) {
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Reservation reserve(String callerEmail, Long eventId, CreateReservationRequest req) {
        User user = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is not PUBLISHED");
        }
        if (event.getStartAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event already started");
        }

        int updated = eventRepository.adjustSeats(eventId, req.quantity());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");
        }

        return reservationRepository.findByUserAndEventAndStatus(user, event, ReservationStatus.ACTIVE)
                .map(existing -> {
                    existing.setQuantity(existing.getQuantity() + req.quantity());
                    return existing;
                })
                .orElseGet(() -> {
                    Reservation r = new Reservation();
                    r.setUser(user);
                    r.setEvent(event);
                    r.setQuantity(req.quantity());
                    r.setStatus(ReservationStatus.ACTIVE);
                    return reservationRepository.save(r);
                });
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
