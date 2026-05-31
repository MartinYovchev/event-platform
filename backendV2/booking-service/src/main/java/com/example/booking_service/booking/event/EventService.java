package com.example.booking_service.booking.event;

import com.example.booking_service.booking.event.dto.CreateEventRequest;
import com.example.booking_service.booking.event.dto.UpdateEventRequest;
import com.example.booking_service.booking.reservation.Reservation;
import com.example.booking_service.booking.reservation.ReservationRepository;
import com.example.booking_service.booking.reservation.ReservationStatus;
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
    private final ReservationRepository reservationRepository;

    public EventService(EventRepository eventRepository,
                        ReservationRepository reservationRepository) {
        this.eventRepository = eventRepository;
        this.reservationRepository = reservationRepository;
    }

    public Page<Event> listMine(Long organizerId, EventStatus status, int page, int size) {
        List<Specification<Event>> parts = new ArrayList<>();
        parts.add((root, q, cb) -> cb.equal(root.get("organizerId"), organizerId));
        if (status != null) {
            parts.add((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        Specification<Event> spec = Specification.allOf(parts);
        return eventRepository.findAll(spec, PageRequest.of(page, size, Sort.by("startAt").descending()));
    }

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
    public Event getVisibleById(Long id, Long callerIdOrNull) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean visible = e.getStatus() == EventStatus.PUBLISHED
                || (callerIdOrNull != null && e.getOrganizerId().equals(callerIdOrNull));
        if (!visible) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return e;
    }

    @Transactional
    public Event create(Long organizerId, String organizerDisplayName, boolean isOrganizer, CreateEventRequest req) {
        if (!isOrganizer) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an organizer");
        }
        if (!req.endAt().isAfter(req.startAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt must be after startAt");
        }

        Event e = new Event();
        e.setOrganizerId(organizerId);
        e.setOrganizerDisplayName(organizerDisplayName);
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
    public Event update(Long callerId, Long id, UpdateEventRequest req) {
        Event e = requireOwnedBy(id, callerId);
        switch (e.getStatus()) {
            case DRAFT -> applyAll(e, req);
            case PUBLISHED -> applyLimited(e, req);
            case CANCELLED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is cancelled");
        }
        return e;
    }

    @Transactional
    public Event publish(Long callerId, Long id) {
        Event e = requireOwnedBy(id, callerId);
        if (e.getStatus() != EventStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be published");
        }
        e.setStatus(EventStatus.PUBLISHED);
        return e;
    }

    @Transactional
    public Event cancel(Long callerId, Long id) {
        Event e = requireOwnedBy(id, callerId);
        if (e.getStatus() == EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");
        }
        applyCancellation(e);
        return e;
    }

    // Shared cascade: cancel every live (ACTIVE/PENDING) reservation on this event, zero
    // seats_taken, mark the event itself CANCELLED. Must be called inside an active transaction.
    // Used by cancel(callerId, id) (after the ownership check) and by the UserDeleted Rabbit
    // consumer when cleaning up a deleted organizer's events.
    public void applyCancellation(Event e) {
        if (e.getStatus() == EventStatus.CANCELLED) return;
        for (Reservation r : reservationRepository.findAllByEventAndStatusIn(
                e, List.of(ReservationStatus.ACTIVE, ReservationStatus.PENDING))) {
            r.setStatus(ReservationStatus.CANCELLED);
        }
        e.setSeatsTaken(0);
        e.setStatus(EventStatus.CANCELLED);
    }

    /** UserDeleted consumer: cancel every DRAFT/PUBLISHED event organized by a deleted user. */
    @Transactional
    public void cancelEventsForOrganizer(Long organizerId) {
        for (Event e : eventRepository.findAllByOrganizerIdAndStatusIn(
                organizerId, List.of(EventStatus.DRAFT, EventStatus.PUBLISHED))) {
            applyCancellation(e);
        }
    }

    @Transactional
    public void deleteDraft(Long callerId, Long id) {
        Event e = requireOwnedBy(id, callerId);
        if (e.getStatus() != EventStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be deleted");
        }
        eventRepository.delete(e);
    }

    // ---------- helpers ----------

    private Event requireOwnedBy(Long id, Long callerId) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!e.getOrganizerId().equals(callerId)) {
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
