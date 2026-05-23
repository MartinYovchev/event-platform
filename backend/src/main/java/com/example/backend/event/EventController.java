package com.example.backend.event;

import com.example.backend.event.dto.CreateEventRequest;
import com.example.backend.event.dto.EventListItemResponse;
import com.example.backend.event.dto.EventResponse;
import com.example.backend.event.dto.UpdateEventRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

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

    @GetMapping("/{id}")
    public EventResponse get(@PathVariable Long id, Authentication auth) {
        String email = auth == null ? null : auth.getName();
        return EventResponse.from(eventService.getVisibleById(id, email));
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@Valid @RequestBody CreateEventRequest req, Authentication auth) {
        Event e = eventService.create(auth.getName(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(EventResponse.from(e));
    }

    @PatchMapping("/{id}")
    public EventResponse update(@PathVariable Long id, @Valid @RequestBody UpdateEventRequest req, Authentication auth) {
        return EventResponse.from(eventService.update(auth.getName(), id, req));
    }

    @PostMapping("/{id}/publish")
    public EventResponse publish(@PathVariable Long id, Authentication auth) {
        return EventResponse.from(eventService.publish(auth.getName(), id));
    }

    @PostMapping("/{id}/cancel")
    public EventResponse cancel(@PathVariable Long id, Authentication auth) {
        return EventResponse.from(eventService.cancel(auth.getName(), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        eventService.deleteDraft(auth.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
