# Phase 4 — Stripe Integration (Future Work)

## Scope

**No code is written in this phase.** This doc captures the design and open questions so the future Stripe slice can start without re-litigating product decisions.

When delivered, Phase 4 will:
- Introduce a paid path on reservations: a Stripe `PaymentIntent` is created when the user clicks "Buy", and `seats_taken` only commits once the webhook confirms payment.
- Add a 15-minute hold so seats aren't locked forever on abandoned checkouts.
- Cap free events to bypass Stripe entirely (no `PaymentIntent` when `price == 0`).

In scope (future):
- New `PENDING_PAYMENT` reservation state
- `PaymentIntent` lifecycle + webhook handling
- A scheduled sweeper that releases expired holds
- `/api/payments/config` endpoint exposing the publishable key to the SPA

Out of scope (still):
- Refund flows (manual via dashboard for now)
- Stripe Connect / per-organizer payouts (single platform account for v1)
- Multi-currency (single `currency` column on event, default `EUR`)

---

## Why this is deferred

MVP needs people to use the system end-to-end and report what works. Real money introduces:
- Webhook reliability + idempotency
- Refunds + disputes
- Payment-failed UX
- Test-card vs live-card environments

None of that affects whether the *event flow itself* is sound. Ship Phases 1–3 first, then layer payments on a stable base.

---

## High-level flow (future)

```
client                       backend                       Stripe
  |                             |                             |
  |--POST /events/{id}/reservations { quantity }-------------->|
  |                             |                             |
  |                             |--SELECT event, hold seats-->|
  |                             |   (insert reservation       |
  |                             |    PENDING_PAYMENT;          |
  |                             |    adjustSeats(+quantity);  |
  |                             |    set hold_expires_at)     |
  |                             |                             |
  |                             |--create PaymentIntent------>|
  |                             |<--client_secret-------------|
  |<--201 { reservationId, clientSecret }-                    |
  |                                                           |
  |--confirmCardPayment(clientSecret)------------------------>|
  |                                                           |
  |                          (webhook)                        |
  |                             |<-payment_intent.succeeded--|
  |                             |--reservation.ACTIVE-------->|
  |                             |   (clear hold_expires_at)   |
  |                             |                             |
  |--GET /me/reservations/{id}->|                             |
  |<--{ status: ACTIVE, paid }--|                             |
```

If the webhook never arrives (or arrives with `payment_intent.payment_failed`), the **sweeper** (or the failure webhook itself) marks the row `CANCELLED` and decrements `seats_taken`.

---

## Hold strategy

Two options were debated. Recommendation: **option A**.

| Option | Behavior on reserve | Risk |
|--------|--------------------|------|
| **A — Hold seats immediately, refund seats on failure** | `adjustSeats(+quantity)` runs synchronously when the PaymentIntent is created. Reservation row in `PENDING_PAYMENT` with `hold_expires_at = now() + 15m`. On success the hold becomes the actual booking; on failure / timeout, sweeper runs `adjustSeats(-quantity)`. | Briefly under-reports capacity to other users during checkout. **Accepted** — that's normal ticketing UX. |
| B — Don't touch `seats_taken` until paid | Cleaner counter. | Multiple users can pay for the last seat simultaneously → oversell. Requires a separate hold table + lock. Worse. |

---

## Future schema (`V5__stripe.sql`, sketch)

```sql
-- New status to track paid reservations.
ALTER TABLE reservations
    DROP CONSTRAINT reservations_status_chk;
ALTER TABLE reservations
    ADD CONSTRAINT reservations_status_chk
    CHECK (status IN ('PENDING_PAYMENT','ACTIVE','CANCELLED','REFUNDED'));

-- Hold + payment metadata on each reservation.
ALTER TABLE reservations
    ADD COLUMN hold_expires_at   TIMESTAMPTZ NULL,
    ADD COLUMN payment_intent_id TEXT        NULL UNIQUE,
    ADD COLUMN paid_at           TIMESTAMPTZ NULL,
    ADD COLUMN refunded_at       TIMESTAMPTZ NULL;

-- A reservation has at most one in-flight PaymentIntent at a time.
CREATE INDEX reservations_hold_idx
    ON reservations(hold_expires_at)
    WHERE status = 'PENDING_PAYMENT';

-- Currency on events for Stripe.
ALTER TABLE events
    ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE events
    ADD CONSTRAINT events_currency_chk
    CHECK (currency ~ '^[A-Z]{3}$');

-- Stripe events table for webhook idempotency.
CREATE TABLE stripe_events (
    id         TEXT        PRIMARY KEY,           -- the Stripe event.id
    type       TEXT        NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload    JSONB       NOT NULL
);
```

The active-reservation uniqueness from Phase 2 needs updating too — a user may have a `PENDING_PAYMENT` row AND no other active row, so:

```sql
DROP INDEX reservations_user_event_active_idx;
CREATE UNIQUE INDEX reservations_user_event_active_idx
    ON reservations(user_id, event_id)
    WHERE status IN ('PENDING_PAYMENT','ACTIVE');
```

---

## Future endpoints

| Method | Path                              | Auth | Description |
|--------|-----------------------------------|------|-------------|
| GET    | `/api/payments/config`            | public | `{ "publishableKey": "pk_..." }` |
| POST   | `/api/events/{id}/reservations`   | JWT   | Now returns `{ reservationId, clientSecret }` for paid events; old shape preserved for free events (price = 0). |
| POST   | `/api/stripe/webhook`             | signature-verified, public | Handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`. |

---

## Future config (`application.properties`)

```properties
# Stripe — leave empty until enabled.
stripe.secret-key=${STRIPE_SECRET_KEY:}
stripe.publishable-key=${STRIPE_PUBLISHABLE_KEY:}
stripe.webhook-secret=${STRIPE_WEBHOOK_SECRET:}

# Hold window for unpaid reservations.
app.reservations.hold-minutes=15
```

---

## Security

- `POST /api/stripe/webhook` is permit-all but **must** verify the `Stripe-Signature` header against `stripe.webhook-secret` BEFORE deserialising the JSON body. The endpoint reads the raw body as a `byte[]` (no `@RequestBody`-driven parsing). Stripe's Java SDK provides `Webhook.constructEvent(payload, sigHeader, secret)`.
- **Idempotency**: every incoming webhook's `event.id` is inserted into `stripe_events` with `ON CONFLICT DO NOTHING`. If the insert returns 0 rows, we've already processed this event and skip.
- The reservation owner is always the authenticated caller — never trust the `metadata` on the PaymentIntent for ownership (we control it server-side anyway, but defense in depth).
- `/api/payments/config` is public and only exposes the publishable key, never the secret key.

---

## Sweeper job (future)

A `@Scheduled` task in a new `payment/HoldSweeper.java`:

```java
@Scheduled(fixedDelayString = "PT30S")
@Transactional
public void releaseExpiredHolds() {
    Instant cutoff = Instant.now();
    for (Reservation r : reservationRepository.findExpiredHolds(cutoff)) {
        eventRepository.adjustSeats(r.getEvent().getId(), -r.getQuantity());
        r.setStatus(ReservationStatus.CANCELLED);
    }
}
```

Where `findExpiredHolds` is:

```java
@Query("""
    SELECT r FROM Reservation r
    WHERE r.status = com.example.backend.reservation.ReservationStatus.PENDING_PAYMENT
      AND r.holdExpiresAt < :cutoff
""")
List<Reservation> findExpiredHolds(@Param("cutoff") Instant cutoff);
```

Requires enabling Spring's scheduler via `@EnableScheduling` on a `@Configuration` class (likely a new `SchedulingConfig` so it's explicit).

---

## Free events (price = 0)

If `event.price.signum() == 0`, the reservation service:
- Skips Stripe entirely.
- Immediately writes the row as `ACTIVE` (today's Phase-2 behavior).
- Returns the response without a `clientSecret` field.

This keeps free events fast and avoids creating zero-amount PaymentIntents.

---

## Open questions to settle when this phase starts

1. **Refunds on event cancellation** — auto-refund via Stripe (`PaymentIntent.cancel` for pending, `Refund.create` for paid), or just mark `REFUNDED` and let the organizer do it manually? Recommendation: auto-refund. Less surprise for buyers.
2. **Partial refunds on quantity cancellation** — if a user cancels 1 of 3 tickets, do we partially refund? MVP-Stripe: keep cancellation **all-or-nothing** (cancel the whole reservation, full refund). Revisit later.
3. **Currency** — start with `EUR` only, or support per-event currency at launch? Recommendation: per-event currency from day one (the column is already there), default `EUR`.
4. **Webhook host visibility** — in dev, Stripe needs to reach `localhost`. Document the `stripe listen --forward-to localhost:8081/api/stripe/webhook` CLI flow in the README before this phase starts.
5. **Free vs paid event toggle** — once an event has any paid reservation, should organizers be allowed to change the price? Recommendation: no — freeze `price` after the first paid reservation.

---

## Dependencies to add when the phase starts

```xml
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>27.2.0</version> <!-- pin to current stable at the time -->
</dependency>
```

Spring's `@EnableScheduling` is built-in — no extra dep needed for the sweeper.

---

## Implementation order (when this phase starts)

1. Add the Stripe SDK dep.
2. Write `V5__stripe.sql`. Apply.
3. Update `Reservation.java` + `ReservationStatus` enum (add `PENDING_PAYMENT`, `REFUNDED`).
4. Add Stripe config props and a `StripeProperties` `@ConfigurationProperties` bean.
5. Build a thin `StripeClient` service that wraps `PaymentIntent.create`, `PaymentIntent.cancel`, `Refund.create`.
6. Modify `ReservationService.reserve` to branch on `event.price == 0` → existing Phase-2 path; else create a hold + PaymentIntent and return `clientSecret`.
7. Build `StripeWebhookController` with signature verification + idempotency.
8. Build `HoldSweeper`.
9. Wire `EventService.cancel` to also refund any paid reservations on that event.
10. Update verification: hand-test with `stripe listen` + a test card.

---

## Verification (future)

Once implemented, the smoke test is:

1. Create a paid event (price = 10).
2. As a buyer, `POST /api/events/{id}/reservations { "quantity": 2 }` → 201 with `clientSecret`. `GET /api/events/{id}` shows `seatsTaken += 2`.
3. Use `stripe listen` + the Stripe test card `4242 4242 4242 4242` to confirm the PaymentIntent. Webhook fires. Reservation transitions `PENDING_PAYMENT → ACTIVE`.
4. Reserve again, **don't** confirm. Wait 15 minutes (or temporarily lower `app.reservations.hold-minutes=1`). Sweeper fires; row → `CANCELLED`; seats released.
5. Reserve + pay + organizer cancels the event → automatic refund (PaymentIntent canceled or Refund created). Buyer sees `status: REFUNDED`.
6. Re-fire the same webhook event id by hand — second hit is a no-op (idempotency works).
7. Tamper with the signature header → webhook returns 400 immediately, no DB write.

When all seven pass on Stripe test mode, flip the secret/publishable keys to live mode and ship.
