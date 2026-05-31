-- Paid reservations introduce a PENDING state (seats held while a Stripe checkout is in
-- flight). Widen the status CHECK and make the "one live reservation per user/event"
-- uniqueness cover both ACTIVE and PENDING so a pending hold also blocks duplicates.

ALTER TABLE reservations DROP CONSTRAINT reservations_status_chk;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_chk
    CHECK (status IN ('PENDING','ACTIVE','CANCELLED'));

DROP INDEX reservations_user_event_active_idx;
CREATE UNIQUE INDEX reservations_user_event_live_idx
    ON reservations(user_id, event_id) WHERE status IN ('ACTIVE','PENDING');
