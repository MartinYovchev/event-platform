-- Allow PENDING (seat held, awaiting payment)
ALTER TABLE reservations DROP CONSTRAINT reservations_status_chk;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_chk
    CHECK (status IN ('PENDING','ACTIVE','CANCELLED'));

ALTER TABLE reservations
    ADD COLUMN stripe_session_id        TEXT,
    ADD COLUMN stripe_payment_intent_id TEXT,
    ADD COLUMN paid_at                  TIMESTAMPTZ;

CREATE INDEX reservations_stripe_session_idx
    ON reservations(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- One live reservation per user/event — now PENDING holds count too
DROP INDEX reservations_user_event_active_idx;
CREATE UNIQUE INDEX reservations_user_event_live_idx
    ON reservations(user_id, event_id) WHERE status IN ('ACTIVE','PENDING');