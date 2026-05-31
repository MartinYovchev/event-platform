CREATE TABLE events (
                        id                          BIGSERIAL     PRIMARY KEY,
                        organizer_id                BIGINT        NOT NULL,
                        organizer_display_name      TEXT          NOT NULL,
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

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE reservations (
                              id          BIGSERIAL    PRIMARY KEY,
                              user_id     BIGINT       NOT NULL,
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
CREATE TRIGGER reservations_set_updated_at
    BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();