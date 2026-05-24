# Phase 3 — Account Page & Soft Delete

## Scope

Make the account page real: profile edit, password change, list of my events, list of my reservations, and delete account. Account deletion is **soft**: a `deleted_at` timestamp + email/displayName anonymization, plus cascade-cancel for everything the user owned. This keeps history rows intact (reservations and events stay queryable, just attributed to "Deleted user").

In scope:
- `users.deleted_at` column
- `GET /api/users/me` (extend response)
- `PATCH /api/users/me`
- `POST /api/users/me/password`
- `DELETE /api/users/me`
- `GET /api/me/events?status=...`
- `GET /api/me/reservations?when=...` (already shipped in Phase 2; documented here for completeness)
- Login refuses soft-deleted users

Out of scope:
- Email change (requires re-verification flow — leave for later)
- Avatar upload (no file storage yet)
- Payment / refund logic (Phase 4)

---

## Schema

File: `backend/src/main/resources/db/migration/V4__user_soft_delete.sql`

```sql
ALTER TABLE users
    ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- Helps `findActiveByEmail` queries skip the index for tombstoned rows.
CREATE INDEX users_deleted_at_idx ON users(deleted_at) WHERE deleted_at IS NULL;
```

> The existing `users_email_key` UNIQUE constraint on `email` is **still global**, which is why deletion has to rewrite the email to something like `deleted_<id>@deleted.local` — otherwise a new user couldn't reuse the address. That re-write happens in the service, not in the DB.

---

## Endpoints

| Method | Path                                       | Auth         | Description                                       | Codes              |
|--------|--------------------------------------------|--------------|---------------------------------------------------|--------------------|
| GET    | `/api/users/me`                            | JWT          | Now includes `isOrganizer`, `createdAt`            | 200, 401           |
| PATCH  | `/api/users/me`                            | JWT          | Change `displayName`                              | 200, 400, 401      |
| POST   | `/api/users/me/password`                   | JWT          | `{ oldPassword, newPassword }`                    | 200, 400, 401      |
| DELETE | `/api/users/me`                            | JWT          | Soft-delete + cascade-cancel events & reservations| 204, 401           |
| GET    | `/api/me/events?status=DRAFT\|PUBLISHED\|CANCELLED&page=&size=` | JWT | Paged list of events I organize. Empty for non-organizers. | 200, 401 |
| GET    | `/api/me/reservations?when=upcoming\|past` | JWT          | Already in Phase 2 — listed here for completeness | 200, 401           |

---

## Java code map

Touched files only — no new packages.

### `user/User.java` — new field

```java
@Column(name = "deleted_at")
private Instant deletedAt;

public Instant getDeletedAt() { return deletedAt; }
public void setDeletedAt(Instant t) { this.deletedAt = t; }
```

### `user/UserRepository.java` — convenience finder

```java
Optional<User> findByEmailAndDeletedAtIsNull(String email);
```

Use this in `AuthService.login`. The plain `findByEmail` is fine elsewhere (we want to be able to fetch even a deleted user by id when populating historical reservation responses).

### `auth/AuthService.java` — refuse deleted users

In `login`:

```java
User user = userRepository.findByEmailAndDeletedAtIsNull(req.email())
        .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
```

`register` doesn't need changes — anonymized emails (`deleted_<id>@deleted.local`) are syntactically valid and globally unique, so the `existsByEmail` check works as-is.

### `auth/dto/UserResponse.java` — richer payload

```java
public record UserResponse(
        Long id,
        String email,
        String displayName,
        String role,
        Boolean isOrganizer,
        Instant createdAt
) {
    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                u.getRole().name(),
                Boolean.TRUE.equals(u.getIsOrganizer()),
                u.getCreatedAt()
        );
    }
}
```

### `user/dto/UpdateProfileRequest.java`  *(new)*

```java
package com.example.backend.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 100) String displayName
) {}
```

### `user/dto/ChangePasswordRequest.java`  *(new)*

```java
package com.example.backend.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank String oldPassword,
        @NotBlank @Size(min = 8, max = 72) String newPassword
) {}
```

### `user/UserController.java` — extended

```java
package com.example.backend.user;

import com.example.backend.auth.dto.UserResponse;
import com.example.backend.user.dto.ChangePasswordRequest;
import com.example.backend.user.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public UserResponse me(Authentication auth) {
        return UserResponse.from(loadMe(auth));
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@Valid @RequestBody UpdateProfileRequest req, Authentication auth) {
        return UserResponse.from(userService.updateProfile(auth.getName(), req));
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req, Authentication auth) {
        userService.changePassword(auth.getName(), req);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(Authentication auth) {
        userService.deleteAccount(auth.getName());
        return ResponseEntity.noContent().build();
    }

    private User loadMe(Authentication auth) {
        return userRepository.findByEmailAndDeletedAtIsNull(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
```

### `user/UserService.java`  *(new)*

```java
package com.example.backend.user;

import com.example.backend.event.Event;
import com.example.backend.event.EventRepository;
import com.example.backend.event.EventService;
import com.example.backend.event.EventStatus;
import com.example.backend.reservation.Reservation;
import com.example.backend.reservation.ReservationRepository;
import com.example.backend.reservation.ReservationStatus;
import com.example.backend.user.dto.ChangePasswordRequest;
import com.example.backend.user.dto.UpdateProfileRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class UserService {

    private final UserRepository        userRepository;
    private final EventRepository       eventRepository;
    private final ReservationRepository reservationRepository;
    private final PasswordEncoder       passwordEncoder;

    public UserService(UserRepository u, EventRepository e, ReservationRepository r, PasswordEncoder pe) {
        this.userRepository = u;
        this.eventRepository = e;
        this.reservationRepository = r;
        this.passwordEncoder = pe;
    }

    @Transactional
    public User updateProfile(String email, UpdateProfileRequest req) {
        User u = requireActive(email);
        u.setDisplayName(req.displayName());
        return u;
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequest req) {
        User u = requireActive(email);
        if (u.getPasswordHash() == null || !passwordEncoder.matches(req.oldPassword(), u.getPasswordHash()))
            throw new BadCredentialsException("Old password is incorrect");
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
    }

    @Transactional
    public void deleteAccount(String email) {
        User u = requireActive(email);

        // 1. Cancel every active reservation owned by this user — releases seats.
        for (Reservation r : reservationRepository.findAllByUserAndStatus(u, ReservationStatus.ACTIVE)) {
            Event e = r.getEvent();
            // Only PUBLISHED events have seats_taken > 0; the atomic UPDATE no-ops on others.
            eventRepository.adjustSeats(e.getId(), -r.getQuantity());
            r.setStatus(ReservationStatus.CANCELLED);
        }

        // 2. Cancel every DRAFT or PUBLISHED event organized by this user.
        for (Event e : eventRepository.findAllByOrganizerAndStatusIn(u,
                java.util.List.of(EventStatus.DRAFT, EventStatus.PUBLISHED))) {
            // Reuse the cascade logic from EventService (which itself cancels active reservations).
            cancelEventInternally(e);
        }

        // 3. Anonymize + tombstone.
        u.setDeletedAt(Instant.now());
        u.setEmail("deleted_" + u.getId() + "@deleted.local");
        u.setDisplayName("Deleted user");
        u.setPasswordHash(null);
        u.setIsOrganizer(false);
    }

    private void cancelEventInternally(Event e) {
        if (e.getStatus() == EventStatus.CANCELLED) return;
        for (Reservation r : reservationRepository.findAllByEventAndStatus(e, ReservationStatus.ACTIVE)) {
            r.setStatus(ReservationStatus.CANCELLED);
        }
        e.setSeatsTaken(0);
        e.setStatus(EventStatus.CANCELLED);
    }

    private User requireActive(String email) {
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
```

> **Why duplicate `cancelEventInternally` instead of calling `EventService.cancel`?** `EventService.cancel` requires the caller to own the event; here we're acting on the user's behalf during their own deletion, not as the organizer making a regular cancel call. Same logic, no ownership check. If you'd rather inject `EventService` and pass `email = u.getEmail()`, that works too — the email matches before we anonymize.

### Add to `reservation/ReservationRepository.java`

```java
List<Reservation> findAllByUserAndStatus(User user, ReservationStatus status);
```

### Add to `event/EventRepository.java`

```java
import java.util.Collection;

List<Event> findAllByOrganizerAndStatusIn(User organizer, Collection<EventStatus> statuses);

@Query("""
    SELECT e FROM Event e
    WHERE e.organizer = :organizer
      AND (:status IS NULL OR e.status = :status)
    ORDER BY e.startAt DESC
""")
Page<Event> findMine(@Param("organizer") User organizer,
                     @Param("status")    EventStatus status,
                     Pageable pageable);
```

### Extend `me/MeController.java`

```java
@GetMapping("/events")
public Page<EventListItemResponse> myEvents(
        @RequestParam(required = false) EventStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        Authentication auth) {
    User me = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    return eventRepository.findMine(me, status, PageRequest.of(page, size))
            .map(EventListItemResponse::from);
}
```

> Non-organizer callers simply get an empty page — they have no events.

---

## Step-by-step build order

1. **Migration**: write `V4__user_soft_delete.sql`. Start the app.
2. **Entity**: add `deletedAt` field on `User`. Restart for validate.
3. **Repository**: `findByEmailAndDeletedAtIsNull` on `UserRepository`; `findAllByUserAndStatus` on `ReservationRepository`; `findAllByOrganizerAndStatusIn` + `findMine` on `EventRepository`.
4. **DTOs**: `UpdateProfileRequest`, `ChangePasswordRequest`.
5. **`UserResponse`**: add `createdAt`.
6. **`AuthService.login`**: switch to `findByEmailAndDeletedAtIsNull`.
7. **Service**: new `UserService.java`.
8. **Controller**: extend `UserController` with the four new routes.
9. **MeController**: add `GET /api/me/events`.
10. **Smoke** with the curls below.

---

## Validation rules

| Field        | Rule                              | Annotation                      |
|--------------|-----------------------------------|---------------------------------|
| displayName  | required, 1–100 chars             | `@NotBlank @Size(max=100)`      |
| oldPassword  | required, non-blank               | `@NotBlank`                     |
| newPassword  | required, 8–72 chars              | `@NotBlank @Size(min=8,max=72)` |

Plus service checks: `oldPassword` must match the stored hash.

---

## Error contract

| Status | When                                                | How                                    |
|--------|-----------------------------------------------------|----------------------------------------|
| 400    | jakarta-validation failure                          | Spring default                         |
| 401    | missing/invalid JWT, or wrong old password          | `BadCredentialsException` / Spring Security |
| 204    | DELETE /me succeeded                                | `ResponseEntity.noContent()`           |

---

## What this phase reuses

- `PasswordEncoder` from `PasswordConfig` (BCrypt, strength 10) — same one as registration.
- Cascade pattern from `EventService.cancel` (Phase 2) — duplicated as `cancelEventInternally` to drop the ownership precondition.
- `Reservation` / `Event` aggregates from Phases 1 and 2.
- `Authentication.getName()` → email pattern, same as everywhere else.

---

## Verification

```bash
# 0. Register two users; capture $T_A (organizer-to-be) and $T_B.

# 1. Update display name.
curl -i -X PATCH http://localhost:8081/api/users/me \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"displayName":"Martin Y."}'
curl -s http://localhost:8081/api/users/me -H "Authorization: Bearer $T_A" | jq '.displayName'
# Expect: "Martin Y."

# 2. Change password with wrong old → 401.
curl -i -X POST http://localhost:8081/api/users/me/password \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"oldPassword":"wrong","newPassword":"newpassword123"}'

# 3. Change password correctly → 200; old password no longer logs in; new one does.
curl -i -X POST http://localhost:8081/api/users/me/password \
  -H "Authorization: Bearer $T_A" -H "Content-Type: application/json" \
  -d '{"oldPassword":"password","newPassword":"newpassword123"}'
# Login with old → 401; with new → 200.

# 4. List my events (organizer, with at least one event).
curl -s 'http://localhost:8081/api/me/events?status=PUBLISHED' \
  -H "Authorization: Bearer $T_A" | jq '.content | length'

# 5. Become organizer + create an event + B reserves it (Phase 1 + 2 prereq).

# 6. DELETE my account.
curl -i -X DELETE http://localhost:8081/api/users/me \
  -H "Authorization: Bearer $T_A"
# Expect: 204.

# 7. Side effects:
#    - Every PUBLISHED/DRAFT event organized by A is now CANCELLED.
#    - Every ACTIVE reservation owned by A is now CANCELLED; seats released.
#    - Login as A → 401 (BadCredentials).
#    - Querying B's reservations still shows A's CANCELLED event (now titled the same,
#      but the organizer name on the event response is "Deleted user").

# 8. Register a new account using A's original email → 201 (the anonymized row no
#    longer has that email, so the unique constraint is free).
```

Phase 3 is done when all eight produce the expected outcome.
