package com.example.booking_service.booking.event;

import com.example.booking_service.booking.common.Claims;
import com.example.booking_service.booking.event.dto.CreateEventRequest;
import com.example.booking_service.booking.event.dto.EventListItemResponse;
import com.example.booking_service.booking.event.dto.EventResponse;
import com.example.booking_service.booking.event.dto.UpdateEventRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

import static com.example.booking_service.booking.event.EventService.requireUid;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public Page<EventListItemResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return eventService.listPublished(search, from, to, page, size)
                .map(EventListItemResponse::from);
    }

    @GetMapping("/mine")
    public Page<EventListItemResponse> mine(
            @RequestParam(required = false) EventStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt) {
        return eventService.listMine(requireUid(jwt), status, page, size)
                .map(EventListItemResponse::from);
    }

    @GetMapping("/{id}")
    public EventResponse get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Long callerId = jwt == null ? null : Claims.uid(jwt);
        return EventResponse.from(eventService.getVisibleById(id, callerId));
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@Valid @RequestBody CreateEventRequest req,
                                                @AuthenticationPrincipal Jwt jwt) {
        requireUid(jwt);
        Event e = eventService.create(Claims.uid(jwt), Claims.name(jwt), Claims.isOrganizer(jwt), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(EventResponse.from(e));
    }

    @PatchMapping("/{id}")
    public EventResponse update(@PathVariable Long id, @Valid @RequestBody UpdateEventRequest req,
                                @AuthenticationPrincipal Jwt jwt) {
        return EventResponse.from(eventService.update(requireUid(jwt), id, req));
    }

    @PostMapping("/{id}/publish")
    public EventResponse publish(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return EventResponse.from(eventService.publish(requireUid(jwt), id));
    }

    @PostMapping("/{id}/cancel")
    public EventResponse cancel(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return EventResponse.from(eventService.cancel(requireUid(jwt), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        eventService.deleteDraft(requireUid(jwt), id);
        return ResponseEntity.noContent().build();
    }
}
