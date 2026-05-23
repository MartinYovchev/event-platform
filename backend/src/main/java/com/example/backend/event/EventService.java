package com.example.backend.event;

import com.example.backend.event.dto.CreateEventRequest;
import com.example.backend.event.dto.UpdateEventRequest;
import com.example.backend.reservation.Reservation;
import com.example.backend.reservation.ReservationRepository;
import com.example.backend.reservation.ReservationStatus;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;

    public EventService(EventRepository eventRepository,
                        UserRepository userRepository,
                        ReservationRepository reservationRepository) {
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
    }

    // ---------- queries ----------

    public Page<Event> listPublished(String search, Instant from, Instant to, int page, int size) {
        List<Specification<Event>> parts = new ArrayList<>();
        parts.add((root, q, cb) -> cb.equal(root.get("status"), EventStatus.PUBLISHED));
        if (search != null && !search.isBlank()) {
            String like = "%" + search.toLowerCase() + "%";
            parts.add((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("description")), like)
            ));
        }
        if (from != null) {
            parts.add((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("startAt"), from));
        }
        if (to != null) {
            parts.add((root, q, cb) -> cb.lessThanOrEqualTo(root.get("startAt"), to));
        }
        Specification<Event> spec = Specification.allOf(parts);
        return eventRepository.findAll(spec, PageRequest.of(page, size, Sort.by("startAt").ascending()));
    }

    @Transactional(readOnly = true)
    public Event getVisibleById(Long id, String callerEmailOrNull) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean visible = e.getStatus() == EventStatus.PUBLISHED
                || (callerEmailOrNull != null && e.getOrganizer().getEmail().equals(callerEmailOrNull));
        if (!visible) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        // Hydrate organizer inside the tx so EventResponse.from can read it after detach.
        Hibernate.initialize(e.getOrganizer());
        return e;
    }

    // ---------- mutations ----------

    @Transactional
    public Event create(String callerEmail, CreateEventRequest req) {
        User organizer = requireOrganizer(callerEmail);
        if (!req.endAt().isAfter(req.startAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt must be after startAt");
        }

        Event e = new Event();
        e.setOrganizer(organizer);
        e.setTitle(req.title());
        e.setDescription(req.description());
        e.setLocation(req.location());
        e.setStartAt(req.startAt());
        e.setEndAt(req.endAt());
        e.setCapacity(req.capacity());
        e.setPrice(req.price());
        e.setCoverImageUrl(req.coverImageUrl());
        if (req.cancellationCutoffHours() != null) {
            e.setCancellationCutoffHours(req.cancellationCutoffHours());
        }
        e.setStatus(EventStatus.DRAFT);
        return eventRepository.save(e);
    }

    @Transactional
    public Event update(String callerEmail, Long id, UpdateEventRequest req) {
        Event e = requireOwnedBy(id, callerEmail);
        switch (e.getStatus()) {
            case DRAFT -> applyAll(e, req);
            case PUBLISHED -> applyLimited(e, req);
            case CANCELLED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is cancelled");
        }
        return e;
    }

    @Transactional
    public Event publish(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() != EventStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be published");
        }
        e.setStatus(EventStatus.PUBLISHED);
        return e;
    }

    @Transactional
    public Event cancel(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() == EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");
        }
        for (Reservation r : reservationRepository.findAllByEventAndStatus(e, ReservationStatus.ACTIVE)) {
            r.setStatus(ReservationStatus.CANCELLED);
        }
        e.setSeatsTaken(0);
        e.setStatus(EventStatus.CANCELLED);
        return e;
    }

    @Transactional
    public void deleteDraft(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() != EventStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be deleted");
        }
        eventRepository.delete(e);
    }

    // ---------- helpers ----------

    private User requireOrganizer(String email) {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!Boolean.TRUE.equals(u.getIsOrganizer())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an organizer");
        }
        return u;
    }

    private Event requireOwnedBy(Long id, String email) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!e.getOrganizer().getEmail().equals(email)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return e;
    }

    private void applyAll(Event e, UpdateEventRequest r) {
        if (r.title()         != null) e.setTitle(r.title());
        if (r.description()   != null) e.setDescription(r.description());
        if (r.location()      != null) e.setLocation(r.location());
        if (r.startAt()       != null) e.setStartAt(r.startAt());
        if (r.endAt()         != null) e.setEndAt(r.endAt());
        if (r.capacity()      != null) e.setCapacity(r.capacity());
        if (r.price()         != null) e.setPrice(r.price());
        if (r.coverImageUrl() != null) e.setCoverImageUrl(r.coverImageUrl());
        if (r.cancellationCutoffHours() != null) e.setCancellationCutoffHours(r.cancellationCutoffHours());
        if (e.getEndAt() != null && e.getStartAt() != null && !e.getEndAt().isAfter(e.getStartAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt must be after startAt");
        }
    }

    private void applyLimited(Event e, UpdateEventRequest r) {
        if (r.title() != null || r.location() != null || r.startAt() != null
                || r.endAt() != null || r.capacity() != null || r.price() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only description, coverImageUrl, cancellationCutoffHours can change once PUBLISHED");
        }
        if (r.description()   != null) e.setDescription(r.description());
        if (r.coverImageUrl() != null) e.setCoverImageUrl(r.coverImageUrl());
        if (r.cancellationCutoffHours() != null) e.setCancellationCutoffHours(r.cancellationCutoffHours());
    }
}
