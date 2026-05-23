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
    seats_taken                 INTEGER       NOT NULL DEFAULT 0,
    price                       NUMERIC(10,2) NOT NULL DEFAULT 0,
    cover_image_url             TEXT,
    status                      TEXT          NOT NULL DEFAULT 'DRAFT',
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

-- 3. Keep events.updated_at fresh on every row update (Postgres has no ON UPDATE clause).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
