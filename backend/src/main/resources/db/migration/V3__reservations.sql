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

CREATE UNIQUE INDEX reservations_user_event_active_idx
    ON reservations(user_id, event_id) WHERE status = 'ACTIVE';

CREATE INDEX reservations_user_idx  ON reservations(user_id);
CREATE INDEX reservations_event_idx ON reservations(event_id);

-- Reuse the set_updated_at() function defined in V2 to keep updated_at fresh.
CREATE TRIGGER reservations_set_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
