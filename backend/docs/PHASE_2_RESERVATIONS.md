# Phase 2 — Reservations Domain

## Scope

Add the **Reservation** aggregate so authenticated users can claim general-admission tickets on PUBLISHED events. Instant-commit semantics: the moment the request succeeds, `events.seats_taken` is bumped. Same user reserving twice for the same event tops up the existing row; cancellation releases the seats subject to a per-event cutoff. Phase 2 also back-fills the cascade-cancel stub left by Phase 1.

In scope:
- `reservations` table
- `POST /api/events/{id}/reservations` (create or top-up)
- `POST /api/me/reservations/{id}/cancel`
- `GET /api/me/reservations?when=upcoming|past` (on `MeController`)
- Atomic seat counter via a single SQL UPDATE
- Event-cancel cascade (release seats + CANCEL all ACTIVE reservations)

Out of scope:
- Holds with expiration (we're instant-commit; Phase 4 reintroduces a hold concept for Stripe)
- Per-row payment metadata (Phase 4)
- Soft-delete of users (Phase 3)

---

## Schema

File: `backend/src/main/resources/db/migration/V3__reservations.sql`

```sql
CREATE TABLE reservations (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id),
    event_id    BIGINT       NOT NULL REFERENCES events(id),
    quantity    INTEGER      NOT NULL,
    status      TEXT         NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT reservations_status_chk   CHECK (status IN ('ACTIVE','CANCELLED')),
    CONSTRAINT reservations_quantity_chk CHECK (quantity > 0)
);

-- Partial unique: at most ONE active row per (user, event). After cancelling
-- the user can re-reserve because the cancelled row drops out of the index.
CREATE UNIQUE INDEX reservations_user_event_active_idx
    ON reservations(user_id, event_id) WHERE status = 'ACTIVE';

CREATE INDEX reservations_user_idx  ON reservations(user_id);
CREATE INDEX reservations_event_idx ON reservations(event_id);
```

---

## Endpoints

| Method | Path                                       | Auth          | Description                                | Codes              |
|--------|--------------------------------------------|---------------|--------------------------------------------|--------------------|
| POST   | `/api/events/{id}/reservations`            | JWT           | Create new ACTIVE row OR top-up existing   | 201, 400, 401, 404, 409 |
| POST   | `/api/me/reservations/{id}/cancel`         | JWT + owner   | Cancel + release seats (subject to cutoff) | 200, 401, 403, 404, 409 |
| GET    | `/api/me/reservations?when=upcoming\|past` | JWT           | Paged list, default upcoming               | 200, 401           |

---

## Java code map

New package: `com.example.backend.reservation`. Also touches `event/EventRepository.java` (new atomic-update method) and `event/EventService.java` (cancel cascade).

### `reservation/ReservationStatus.java`

```java
package com.example.backend.reservation;

public enum ReservationStatus { ACTIVE, CANCELLED }
```

### `reservation/Reservation.java`

```java
package com.example.backend.reservation;

import com.example.backend.event.Event;
import com.example.backend.user.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "reservations")
public class Reservation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false)
    private Integer quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status = ReservationStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    // getters + setters (omitted)
}
```

### `reservation/ReservationRepository.java`

```java
package com.example.backend.reservation;

import com.example.backend.event.Event;
import com.example.backend.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    Optional<Reservation> findByUserAndEventAndStatus(User user, Event event, ReservationStatus status);

    // Active reservations for an event — used by the event-cancel cascade.
    List<Reservation> findAllByEventAndStatus(Event event, ReservationStatus status);

    // "My reservations" — split by when relative to the event's start time.
    @Query("""
        SELECT r FROM Reservation r
        WHERE r.user = :user
          AND ((:upcoming = TRUE  AND r.event.startAt >= :now AND r.status = com.example.backend.reservation.ReservationStatus.ACTIVE)
            OR (:upcoming = FALSE AND (r.event.startAt < :now OR r.status = com.example.backend.reservation.ReservationStatus.CANCELLED)))
        ORDER BY r.event.startAt ASC
    """)
    Page<Reservation> findMine(@Param("user") User user,
                               @Param("upcoming") boolean upcoming,
                               @Param("now") Instant now,
                               Pageable pageable);
}
```

### Add to `event/EventRepository.java` — the atomic seat counter

```java
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Increment (positive delta) or decrement (negative delta) seats_taken atomically.
 * The WHERE guard makes the statement a no-op if it would overflow capacity or if
 * the event is not PUBLISHED. Returns the number of rows affected (0 or 1).
 *
 * The service calls this and treats `0` as "409 — insufficient capacity / wrong status".
 */
@Modifying
@Query(value = """
    UPDATE events
       SET seats_taken = seats_taken + :delta,
           updated_at  = now()
     WHERE id = :eventId
       AND status = 'PUBLISHED'
       AND seats_taken + :delta >= 0
       AND seats_taken + :delta <= capacity
""", nativeQuery = true)
int adjustSeats(@Param("eventId") Long eventId, @Param("delta") int delta);
```

> **Why `nativeQuery = true`?** JPQL doesn't easily express `seats_taken + :delta <= capacity` cross-column comparisons. Native SQL is clearer and Postgres-atomic.

> **`@Modifying`** tells Spring Data this query writes — it returns an `int` row-count instead of a result list.

### `reservation/dto/CreateReservationRequest.java`

```java
package com.example.backend.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateReservationRequest(
        @NotNull @Min(1) @Max(20) Integer quantity
) {}
```

The `Max(20)` cap matches `app.reservations.max-per-request=20` in `application.properties` (add the property).

### `reservation/dto/ReservationResponse.java`

```java
package com.example.backend.reservation.dto;

import com.example.backend.reservation.Reservation;
import java.time.Instant;

public record ReservationResponse(
        Long id,
        Long eventId,
        String eventTitle,
        Instant eventStartAt,
        Integer quantity,
        String status,
        Instant createdAt
) {
    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(
                r.getId(),
                r.getEvent().getId(),
                r.getEvent().getTitle(),
                r.getEvent().getStartAt(),
                r.getQuantity(),
                r.getStatus().name(),
                r.getCreatedAt()
        );
    }
}
```

### `reservation/ReservationService.java`

The core of Phase 2. Pay attention to the transaction shape — every write happens inside a single `@Transactional` method so the row insert/update and the atomic `events` UPDATE either both happen or both roll back.

```java
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
    private final EventRepository       eventRepository;
    private final UserRepository        userRepository;

    public ReservationService(ReservationRepository r, EventRepository e, UserRepository u) {
        this.reservationRepository = r;
        this.eventRepository       = e;
        this.userRepository        = u;
    }

    @Transactional
    public Reservation reserve(String callerEmail, Long eventId, CreateReservationRequest req) {
        User user = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        // Pre-check (the atomic UPDATE will re-check, but this gives a clearer error).
        if (event.getStatus() != EventStatus.PUBLISHED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event is not PUBLISHED");
        if (event.getStartAt().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Event already started");

        // Atomic seat bump. Returns 1 on success, 0 if capacity/status would be violated.
        int updated = eventRepository.adjustSeats(eventId, req.quantity());
        if (updated == 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient capacity");

        // Upsert the reservation row.
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
        if (!r.getUser().getEmail().equals(callerEmail))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        if (r.getStatus() != ReservationStatus.ACTIVE)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");

        Event e = r.getEvent();
        Instant cutoff = e.getStartAt().minusSeconds(e.getCancellationCutoffHours() * 3600L);
        if (Instant.now().isAfter(cutoff))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Past cancellation cutoff");

        // Release seats. If event is no longer PUBLISHED (e.g. organizer cancelled it
        // in a race), adjustSeats returns 0 — that's fine; the org cancel already zeroed it.
        eventRepository.adjustSeats(e.getId(), -r.getQuantity());
        r.setStatus(ReservationStatus.CANCELLED);
        return r;
    }

    public Page<Reservation> listMine(String callerEmail, boolean upcoming, int page, int size) {
        User user = userRepository.findByEmail(callerEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return reservationRepository.findMine(user, upcoming, Instant.now(), PageRequest.of(page, size));
    }
}
```

### `reservation/ReservationController.java`

```java
package com.example.backend.reservation;

import com.example.backend.reservation.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping("/api/events/{id}/reservations")
    public ResponseEntity<ReservationResponse> reserve(
            @PathVariable("id") Long eventId,
            @Valid @RequestBody CreateReservationRequest req,
            Authentication auth) {
        Reservation r = reservationService.reserve(auth.getName(), eventId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReservationResponse.from(r));
    }

    @PostMapping("/api/me/reservations/{id}/cancel")
    public ReservationResponse cancel(@PathVariable("id") Long reservationId, Authentication auth) {
        return ReservationResponse.from(reservationService.cancel(auth.getName(), reservationId));
    }
}
```

### Extend `me/MeController.java`

Inject `ReservationService` and add the listing endpoint:

```java
@GetMapping("/reservations")
public Page<ReservationResponse> myReservations(
        @RequestParam(defaultValue = "upcoming") String when,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        Authentication auth) {
    boolean upcoming = "upcoming".equalsIgnoreCase(when);
    return reservationService.listMine(auth.getName(), upcoming, page, size)
            .map(ReservationResponse::from);
}
```

### Back-fill the Phase 1 stub in `event/EventService.java`

Inject `ReservationRepository` and rewrite `cancel(...)` so it actually cascades:

```java
@Transactional
public Event cancel(String callerEmail, Long id) {
    Event e = requireOwnedBy(id, callerEmail);
    if (e.getStatus() == EventStatus.CANCELLED)
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Already cancelled");

    // Cascade-cancel every ACTIVE reservation, then zero out the counter in one go.
    var actives = reservationRepository.findAllByEventAndStatus(e, ReservationStatus.ACTIVE);
    for (Reservation r : actives) {
        r.setStatus(ReservationStatus.CANCELLED);
    }
    e.setSeatsTaken(0);
    e.setStatus(EventStatus.CANCELLED);
    return e;
}
```

### Touched: `application.properties`

```properties
# Max tickets per single create-reservation call.
app.reservations.max-per-request=20
```

(Actually wired through `@Max(20)` in the DTO — keep this as a future config knob; if you wire it, replace the constant in `CreateReservationRequest` with a `@Value` injection.)

### Touched: `config/SecurityConfig.java`

No security changes needed — both `/api/events/{id}/reservations` and `/api/me/**` already match `anyRequest().authenticated()`.

---

## Step-by-step build order

1. **Migration**: write `V3__reservations.sql`. Start the app; Flyway applies it.
2. **Enum**: `ReservationStatus.java`.
3. **Entity**: `Reservation.java`. Restart for `ddl-auto=validate` to confirm.
4. **Atomic update** on `EventRepository.adjustSeats` — write the `@Modifying @Query`. This is the most important piece; test it with an integration test or by hand.
5. **ReservationRepository**: write the three methods.
6. **DTOs**: request + response records.
7. **Service**: `ReservationService.reserve` first (the trickier one), then `cancel`, then `listMine`.
8. **Controller**: `ReservationController.java`.
9. **MeController**: add `/api/me/reservations`.
10. **Back-fill EventService.cancel** to cascade.
11. **Manual smoke** with the curls below.

---

## Validation rules

| Field    | Rule                  | Annotation                |
|----------|-----------------------|---------------------------|
| quantity | required, 1 ≤ q ≤ 20  | `@NotNull @Min(1) @Max(20)` |

Plus service-layer checks: event must exist, be PUBLISHED, and have not started; caller must own the reservation on cancel; cancel must be before the cutoff.

---

## Error contract

| Status | When                                                                                  | How                                    |
|--------|---------------------------------------------------------------------------------------|----------------------------------------|
| 400    | jakarta-validation fails (e.g. quantity 0 or 99)                                      | Spring Validation default              |
| 401    | missing / invalid JWT                                                                 | Spring Security                        |
| 403    | trying to cancel someone else's reservation                                           | `ResponseStatusException(FORBIDDEN)`   |
| 404    | event or reservation not found                                                        | `ResponseStatusException(NOT_FOUND)`   |
| 409    | event not PUBLISHED / already started / no capacity / past cutoff / already CANCELLED | `ResponseStatusException(CONFLICT)`    |

---

## What this phase reuses

- `EventRepository` + `EventStatus` + `Event` from Phase 1.
- `UserRepository.findByEmail` pattern.
- `Authentication.getName()` to identify the caller.
- `@Transactional` propagation — same as `AuthService.register` and Phase 1's `EventService`.

---

## Verification

Setup: two users (`T_A` organizer, `T_B` attendee), one PUBLISHED event id `1` with `capacity=10`, `cancellationCutoffHours=24`, `startAt = now + 48h`.

```bash
# 1. Attendee reserves 3.
curl -s -X POST http://localhost:8081/api/events/1/reservations \
  -H "Authorization: Bearer $T_B" -H "Content-Type: application/json" \
  -d '{"quantity":3}' | jq
# Expect: 201, quantity=3. Then: GET /api/events/1 shows seatsTaken=3.

# 2. Same attendee tops up by 2 → same row, quantity=5.
curl -s -X POST http://localhost:8081/api/events/1/reservations \
  -H "Authorization: Bearer $T_B" -H "Content-Type: application/json" \
  -d '{"quantity":2}' | jq '.quantity'
# Expect: 5. seatsTaken=5.

# 3. Organizer tries to reserve 6 → 409 (5 + 6 > capacity 10).
curl -i -X POST http://localhost:8081/api/events/1/reservations \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"quantity":6}'

# 4. Organizer reserves 5 (fills the event).
curl -s -X POST http://localhost:8081/api/events/1/reservations \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"quantity":5}' | jq
# seatsTaken=10.

# 5. List my reservations (attendee).
curl -s "http://localhost:8081/api/me/reservations?when=upcoming" \
  -H "Authorization: Bearer $T_B" | jq '.content'

# 6. Cancel my reservation.
curl -s -X POST http://localhost:8081/api/me/reservations/1/cancel \
  -H "Authorization: Bearer $T_B" | jq '.status'
# Expect: "CANCELLED". seatsTaken back to 5.

# 7. Try to cancel within the cutoff: edit the event's startAt to now+1h
#    or set cancellationCutoffHours huge, then try cancel → 409.

# 8. Organizer cancels the event → all ACTIVE reservations CANCELLED, seatsTaken=0.
curl -i -X POST http://localhost:8081/api/events/1/cancel \
  -H "Authorization: Bearer $T_A"
curl -s "http://localhost:8081/api/me/reservations?when=past" \
  -H "Authorization: Bearer $T_A" | jq '.content[].status'
# Expect: "CANCELLED" for the organizer's previously-active reservation.

# 9. Re-reserve after cancellation: the partial unique index lets it succeed.
#    (Republish or use a fresh event id for this step.)
```

Phase 2 is done when all nine produce the expected output and seat counters always match `SELECT COALESCE(SUM(quantity), 0) FROM reservations WHERE event_id = ? AND status = 'ACTIVE'`.
