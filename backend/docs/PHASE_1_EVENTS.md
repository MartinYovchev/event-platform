
# Phase 1 — Events Domain

## Scope

Introduce the **Event** aggregate and the **self-service organizer** flag so users can become organizers, create events as DRAFT, publish them, edit them under rules, cancel them, and so the public can browse PUBLISHED events with paging + filtering.

In scope:
- `is_organizer` boolean on `users`
- `events` table with `DRAFT → PUBLISHED → CANCELLED` lifecycle
- Full CRUD-ish API: create, list (public, paged), get, edit, publish, cancel, delete-draft
- `POST /api/me/become-organizer`

Out of scope (later phases):
- Reservations & capacity decrement (Phase 2 — but the `seats_taken` column is added now so Phase 2 can plug in without another migration)
- Soft delete of users (Phase 3)
- Payments (Phase 4)

---

## Schema

File: `backend/src/main/resources/db/migration/V2__events_and_organizer.sql`

```sql
-- 1. Self-service organizer flag (orthogonal to existing USER/ADMIN role).
ALTER TABLE users
    ADD COLUMN is_organizer BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Events table.
CREATE TABLE events (
    id                          BIGSERIAL     PRIMARY KEY,
    organizer_id                BIGINT        NOT NULL REFERENCES users(id),
    title                       TEXT          NOT NULL,
    description                 TEXT          NOT NULL,
    location                    TEXT          NOT NULL,
    start_at                    TIMESTAMPTZ   NOT NULL,
    end_at                      TIMESTAMPTZ   NOT NULL,
    capacity                    INTEGER       NOT NULL,
    -- Denormalised counter used in Phase 2. Always 0 in Phase 1.
    seats_taken                 INTEGER       NOT NULL DEFAULT 0,
    price                       NUMERIC(10,2) NOT NULL DEFAULT 0,
    cover_image_url             TEXT,
    status                      TEXT          NOT NULL DEFAULT 'DRAFT',
    -- How many hours before start_at cancellations are still allowed (used in Phase 2).
    cancellation_cutoff_hours   INTEGER       NOT NULL DEFAULT 24,
    created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT events_status_chk   CHECK (status IN ('DRAFT','PUBLISHED','CANCELLED')),
    CONSTRAINT events_capacity_chk CHECK (capacity > 0 AND seats_taken >= 0 AND seats_taken <= capacity),
    CONSTRAINT events_time_chk     CHECK (end_at > start_at),
    CONSTRAINT events_cutoff_chk   CHECK (cancellation_cutoff_hours >= 0 AND cancellation_cutoff_hours <= 168),
    CONSTRAINT events_price_chk    CHECK (price >= 0)
);

CREATE INDEX events_start_at_idx     ON events(start_at);
CREATE INDEX events_status_start_idx ON events(status, start_at);
CREATE INDEX events_organizer_idx    ON events(organizer_id);
```

> **Why a `seats_taken` column now?** Capacity tracking happens in Phase 2, but adding the column here means Phase 2 doesn't need another migration just to add a column — only the new `reservations` table.

---

## Endpoints

| Method | Path                              | Auth                | Description                                          | Codes              |
|--------|-----------------------------------|---------------------|------------------------------------------------------|--------------------|
| POST   | `/api/me/become-organizer`        | JWT                 | Set `is_organizer = TRUE` on the caller              | 200, 401           |
| POST   | `/api/events`                     | JWT + organizer     | Create event (status = DRAFT)                        | 201, 400, 401, 403 |
| GET    | `/api/events`                     | public              | Paged PUBLISHED events; filters page/size/search/from/to | 200             |
| GET    | `/api/events/{id}`                | public + maybe JWT  | Public for PUBLISHED; organizer sees own DRAFTs      | 200, 404           |
| PATCH  | `/api/events/{id}`                | JWT + owner         | DRAFT: any field. PUBLISHED: only description/cover/cutoff. | 200, 400, 401, 403, 404, 409 |
| POST   | `/api/events/{id}/publish`        | JWT + owner         | DRAFT → PUBLISHED                                    | 200, 401, 403, 404, 409 |
| POST   | `/api/events/{id}/cancel`         | JWT + owner         | → CANCELLED (Phase 2 fills in the cascade)           | 200, 401, 403, 404, 409 |
| DELETE | `/api/events/{id}`                | JWT + owner         | Hard-delete a DRAFT only                             | 204, 401, 403, 404, 409 |

---

## Java code map

New package: `com.example.backend.event`. Also a new `com.example.backend.me` package for `MeController`.

### `event/EventStatus.java`

```java
package com.example.backend.event;

public enum EventStatus { DRAFT, PUBLISHED, CANCELLED }
```

### `event/Event.java` — JPA entity

```java
package com.example.backend.event;

import com.example.backend.user.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Many events can share one organizer. LAZY avoids fetching the User on every query.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizer_id", nullable = false)
    private User organizer;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String location;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(nullable = false)
    private Integer capacity;

    @Column(name = "seats_taken", nullable = false)
    private Integer seatsTaken = 0;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventStatus status = EventStatus.DRAFT;

    @Column(name = "cancellation_cutoff_hours", nullable = false)
    private Integer cancellationCutoffHours = 24;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    // getters + setters for every field (omitted for brevity — use IDE generation)
}
```

> **Spring/JPA cheats**
> - `@Entity + @Table` tells Hibernate this class maps to a table.
> - `@GeneratedValue(IDENTITY)` says "let Postgres assign the id via BIGSERIAL."
> - `@ManyToOne(FetchType.LAZY)` issues a separate SELECT for the organizer only if you touch the field — avoids N+1 by default.
> - `insertable = false, updatable = false` on `createdAt`/`updatedAt` means "the DB owns these columns; don't write them from Java."

### `event/EventRepository.java`

```java
package com.example.backend.event;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    // PUBLIC listing — only PUBLISHED, with case-insensitive substring search on title/description
    // and optional date range. NULL filters are ignored via "X IS NULL OR ..." pattern.
    @Query("""
        SELECT e FROM Event e
        WHERE e.status = com.example.backend.event.EventStatus.PUBLISHED
          AND (:search IS NULL OR
               LOWER(e.title) LIKE LOWER(CONCAT('%', :search, '%')) OR
               LOWER(e.description) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:from IS NULL OR e.startAt >= :from)
          AND (:to   IS NULL OR e.startAt <= :to)
        ORDER BY e.startAt ASC
    """)
    Page<Event> searchPublished(@Param("search") String search,
                                @Param("from") Instant from,
                                @Param("to")   Instant to,
                                Pageable pageable);

    Optional<Event> findByIdAndStatus(Long id, EventStatus status);
}
```

### `event/dto/CreateEventRequest.java`

```java
package com.example.backend.event.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;

public record CreateEventRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 5000) String description,
        @NotBlank @Size(max = 500)  String location,
        @NotNull  @Future            Instant startAt,
        @NotNull  @Future            Instant endAt,
        @NotNull  @Min(1)            Integer capacity,
        @NotNull  @DecimalMin("0.00") BigDecimal price,
        @Size(max = 1000)            String coverImageUrl,
        @Min(0) @Max(168)            Integer cancellationCutoffHours
) {}
```

### `event/dto/UpdateEventRequest.java`

```java
package com.example.backend.event.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;

// All fields optional — only the ones present are applied (PATCH semantics).
// The service decides which fields are legal based on current status.
public record UpdateEventRequest(
        @Size(max = 200)  String title,
        @Size(max = 5000) String description,
        @Size(max = 500)  String location,
        @Future Instant   startAt,
        @Future Instant   endAt,
        @Min(1) Integer   capacity,
        @DecimalMin("0.00") BigDecimal price,
        @Size(max = 1000) String coverImageUrl,
        @Min(0) @Max(168) Integer cancellationCutoffHours
) {}
```

### `event/dto/EventResponse.java`

```java
package com.example.backend.event.dto;

import com.example.backend.event.Event;
import java.math.BigDecimal;
import java.time.Instant;

public record EventResponse(
        Long id,
        Long organizerId,
        String organizerDisplayName,
        String title,
        String description,
        String location,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        Integer seatsTaken,
        BigDecimal price,
        String coverImageUrl,
        String status,
        Integer cancellationCutoffHours,
        Instant createdAt
) {
    public static EventResponse from(Event e) {
        return new EventResponse(
                e.getId(),
                e.getOrganizer().getId(),
                e.getOrganizer().getDisplayName(),
                e.getTitle(), e.getDescription(), e.getLocation(),
                e.getStartAt(), e.getEndAt(),
                e.getCapacity(), e.getSeatsTaken(),
                e.getPrice(), e.getCoverImageUrl(),
                e.getStatus().name(),
                e.getCancellationCutoffHours(),
                e.getCreatedAt()
        );
    }
}
```

### `event/dto/EventListItemResponse.java`

Lighter projection for the public list endpoint.

```java
package com.example.backend.event.dto;

import com.example.backend.event.Event;
import java.math.BigDecimal;
import java.time.Instant;

public record EventListItemResponse(
        Long id, String title, String location,
        Instant startAt, Instant endAt,
        Integer capacity, Integer seatsTaken,
        BigDecimal price, String coverImageUrl
) {
    public static EventListItemResponse from(Event e) {
        return new EventListItemResponse(
                e.getId(), e.getTitle(), e.getLocation(),
                e.getStartAt(), e.getEndAt(),
                e.getCapacity(), e.getSeatsTaken(),
                e.getPrice(), e.getCoverImageUrl()
        );
    }
}
```

### `event/EventService.java`

```java
package com.example.backend.event;

import com.example.backend.event.dto.*;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final UserRepository  userRepository;

    public EventService(EventRepository eventRepository, UserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.userRepository  = userRepository;
    }

    // ---------- queries ----------

    public Page<Event> listPublished(String search, Instant from, Instant to, int page, int size) {
        return eventRepository.searchPublished(search, from, to, PageRequest.of(page, size));
    }

    public Event getVisibleById(Long id, String callerEmailOrNull) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (e.getStatus() == EventStatus.PUBLISHED) return e;
        // DRAFT or CANCELLED — only the owner can see it.
        if (callerEmailOrNull != null && e.getOrganizer().getEmail().equals(callerEmailOrNull)) return e;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    // ---------- mutations ----------

    @Transactional
    public Event create(String callerEmail, CreateEventRequest req) {
        User organizer = requireOrganizer(callerEmail);
        if (!req.endAt().isAfter(req.startAt()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt must be after startAt");

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
        if (req.cancellationCutoffHours() != null)
            e.setCancellationCutoffHours(req.cancellationCutoffHours());
        e.setStatus(EventStatus.DRAFT);
        return eventRepository.save(e);
    }

    @Transactional
    public Event update(String callerEmail, Long id, UpdateEventRequest req) {
        Event e = requireOwnedBy(id, callerEmail);
        switch (e.getStatus()) {
            case DRAFT -> applyAll(e, req);                 // free editing
            case PUBLISHED -> applyLimited(e, req);         // only desc / cover / cutoff
            case CANCELLED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is cancelled");
        }
        return e; // saved by dirty-checking inside the transaction
    }

    @Transactional
    public Event publish(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() != EventStatus.DRAFT)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be published");
        e.setStatus(EventStatus.PUBLISHED);
        return e;
    }

    @Transactional
    public Event cancel(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() == EventStatus.CANCELLED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");
        e.setStatus(EventStatus.CANCELLED);
        // Phase 2: cascade-cancel active reservations and reset seats_taken here.
        return e;
    }

    @Transactional
    public void deleteDraft(String callerEmail, Long id) {
        Event e = requireOwnedBy(id, callerEmail);
        if (e.getStatus() != EventStatus.DRAFT)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT events can be deleted");
        eventRepository.delete(e);
    }

    // ---------- helpers ----------

    private User requireOrganizer(String email) {
        User u = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!Boolean.TRUE.equals(u.getIsOrganizer()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an organizer");
        return u;
    }

    private Event requireOwnedBy(Long id, String email) {
        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!e.getOrganizer().getEmail().equals(email))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
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
        if (e.getEndAt() != null && e.getStartAt() != null && !e.getEndAt().isAfter(e.getStartAt()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt must be after startAt");
    }

    private void applyLimited(Event e, UpdateEventRequest r) {
        // Only these three are editable once published.
        if (r.description()   != null) e.setDescription(r.description());
        if (r.coverImageUrl() != null) e.setCoverImageUrl(r.coverImageUrl());
        if (r.cancellationCutoffHours() != null) e.setCancellationCutoffHours(r.cancellationCutoffHours());

        // If any forbidden field was sent, reject.
        if (r.title() != null || r.location() != null || r.startAt() != null
                || r.endAt() != null || r.capacity() != null || r.price() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only description, coverImageUrl, cancellationCutoffHours can change once PUBLISHED");
        }
    }
}
```

### `event/EventController.java`

```java
package com.example.backend.event;

import com.example.backend.event.dto.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
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
```

### `me/MeController.java`

A new cross-domain controller for `/api/me/*` aggregation endpoints. Phase 1 only has one route here; Phases 2/3 add more.

```java
package com.example.backend.me;

import com.example.backend.auth.dto.UserResponse;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/become-organizer")
    @Transactional
    public UserResponse becomeOrganizer(Authentication auth) {
        User u = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        u.setIsOrganizer(true);
        return UserResponse.from(u);
    }
}
```

### Touched: `user/User.java`

Add a boolean field, getter, setter:

```java
@Column(name = "is_organizer", nullable = false)
private Boolean isOrganizer = false;

public Boolean getIsOrganizer() { return isOrganizer; }
public void setIsOrganizer(Boolean v) { this.isOrganizer = v; }
```

### Touched: `auth/dto/UserResponse.java`

Add `isOrganizer` to the record and to `from(User)`:

```java
public record UserResponse(Long id, String email, String displayName, String role, Boolean isOrganizer) {
    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getDisplayName(),
                u.getRole().name(), Boolean.TRUE.equals(u.getIsOrganizer()));
    }
}
```

### Touched: `config/SecurityConfig.java`

Make GETs on events public. Inside `requestMatchers(...)`:

```java
.requestMatchers(HttpMethod.GET, "/api/events", "/api/events/*").permitAll()
.requestMatchers("/api/auth/**", "/error", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
.anyRequest().authenticated()
```

Order matters — put the GET matchers BEFORE `anyRequest().authenticated()`.

---

## Step-by-step build order

1. **Migration**: create `V2__events_and_organizer.sql` with the SQL above. Start the app once — Flyway should apply it cleanly.
2. **Enum**: `EventStatus.java`.
3. **Entity**: `Event.java` + getters/setters. Restart and let Hibernate validate the schema (`spring.jpa.hibernate.ddl-auto=validate`). Fix any column mismatch.
4. **User entity**: add `isOrganizer` field. Update `UserResponse` to expose it. Restart, hit `/api/users/me` — confirm the field shows up as `false`.
5. **Repository**: `EventRepository.java` with the `searchPublished` query.
6. **DTOs**: the four DTO records under `event/dto/`.
7. **Service**: `EventService.java`. Cover queries first (`getVisibleById`, `listPublished`), then mutations.
8. **Controller**: `EventController.java`.
9. **MeController**: just the `become-organizer` route for now.
10. **Security**: open up `GET /api/events`. Restart.
11. **Test by hand** with the verification curls below.

---

## Validation rules

| Field                       | Rule                                           | Annotation                             |
|----------------------------|------------------------------------------------|----------------------------------------|
| title                       | required, 1–200 chars                          | `@NotBlank @Size(max=200)`             |
| description                 | required, ≤5000 chars                          | `@NotBlank @Size(max=5000)`            |
| location                    | required, ≤500 chars                           | `@NotBlank @Size(max=500)`             |
| startAt                     | required, future                               | `@NotNull @Future`                     |
| endAt                       | required, future, > startAt                    | `@NotNull @Future` + service check     |
| capacity                    | required, ≥ 1                                  | `@NotNull @Min(1)`                     |
| price                       | required on create, ≥ 0                        | `@NotNull @DecimalMin("0.00")`         |
| coverImageUrl               | optional, ≤1000 chars                          | `@Size(max=1000)`                      |
| cancellationCutoffHours     | optional on create (default 24), 0–168         | `@Min(0) @Max(168)`                    |

On PATCH all of these become optional; the same caps apply when present.

---

## Error contract

| Status | When                                                                                | How                              |
|--------|-------------------------------------------------------------------------------------|----------------------------------|
| 400    | jakarta-validation failure or `endAt <= startAt` or forbidden PATCH field           | `MethodArgumentNotValidException` / `ResponseStatusException(BAD_REQUEST)` |
| 401    | missing / invalid JWT on a protected endpoint                                       | Spring Security                  |
| 403    | authenticated but not an organizer, or not the event's organizer                    | `ResponseStatusException(FORBIDDEN)` |
| 404    | event missing, or DRAFT/CANCELLED requested by a non-owner                          | `ResponseStatusException(NOT_FOUND)` |
| 409    | illegal status transition (publish a CANCELLED, delete a PUBLISHED, etc.)           | `ResponseStatusException(CONFLICT)`  |

---

## What this phase reuses

- `UserController.me` — same `Authentication.getName()` → email → `UserRepository.findByEmail` pattern. Reuse it everywhere.
- `AuthService.register` — example of `@Transactional` + `ResponseStatusException` usage.
- `PasswordConfig.passwordEncoder` — not needed in this phase but follow the same "one bean per concern" config style.
- DTOs as `record`s — same style as the existing `RegisterRequest` / `LoginRequest` / `AuthResponse`.

---

## Verification

Set `T_A` and `T_B` to JWTs for two registered users (use `/api/auth/register` and copy the token).

```bash
# 1. User A becomes an organizer.
curl -s -X POST http://localhost:8081/api/me/become-organizer \
  -H "Authorization: Bearer $T_A" | jq
# Expect: 200, "isOrganizer": true.

# 2. User B (non-organizer) tries to create an event → 403.
curl -i -X POST http://localhost:8081/api/events \
  -H "Authorization: Bearer $T_B" -H "Content-Type: application/json" \
  -d '{"title":"X","description":"x","location":"l","startAt":"2026-06-01T19:00:00Z","endAt":"2026-06-01T22:00:00Z","capacity":10,"price":0}'

# 3. User A creates an event (DRAFT).
curl -s -X POST http://localhost:8081/api/events \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"title":"Demo","description":"...","location":"Sofia","startAt":"2026-06-01T19:00:00Z","endAt":"2026-06-01T22:00:00Z","capacity":100,"price":0}' | jq
# Expect: 201, "status": "DRAFT".

# 4. Anonymous list should NOT see the draft.
curl -s 'http://localhost:8081/api/events?page=0&size=10' | jq '.content | length'
# Expect: 0.

# 5. Publish.
curl -s -X POST http://localhost:8081/api/events/1/publish \
  -H "Authorization: Bearer $T_A" | jq '.status'
# Expect: "PUBLISHED".

# 6. Anonymous list now sees it; filter works.
curl -s 'http://localhost:8081/api/events?search=demo' | jq '.content[0].title'

# 7. Edit description in PUBLISHED — allowed.
curl -i -X PATCH http://localhost:8081/api/events/1 \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"description":"new desc"}'

# 8. Edit capacity in PUBLISHED — 400.
curl -i -X PATCH http://localhost:8081/api/events/1 \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"capacity":50}'

# 9. Cancel.
curl -i -X POST http://localhost:8081/api/events/1/cancel \
  -H "Authorization: Bearer $T_A"
# Anonymous list no longer shows it.

# 10. Delete a DRAFT — succeeds. Delete a PUBLISHED or CANCELLED — 409.
```

Run all ten. Phase 1 is done when each shows the expected outcome.
