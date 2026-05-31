CREATE TABLE payments (
    id                        BIGSERIAL    PRIMARY KEY,
    reservation_id            BIGINT       NOT NULL,
    stripe_session_id         TEXT,
    stripe_payment_intent_id  TEXT,
    amount_minor              BIGINT       NOT NULL,
    currency                  TEXT         NOT NULL,
    status                    TEXT         NOT NULL DEFAULT 'PENDING',
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    paid_at                   TIMESTAMPTZ,
    CONSTRAINT payments_status_chk CHECK (status IN ('PENDING','PAID','EXPIRED','FAILED')),
    CONSTRAINT payments_amount_chk CHECK (amount_minor >= 0)
);

CREATE INDEX payments_reservation_idx ON payments(reservation_id);
CREATE UNIQUE INDEX payments_session_idx
    ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
