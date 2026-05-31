CREATE TABLE users (
                       id                BIGSERIAL    PRIMARY KEY,
                       email             CITEXT       NOT NULL UNIQUE,
                       password_hash     TEXT,
                       display_name      TEXT         NOT NULL,
                       role              TEXT         NOT NULL DEFAULT 'USER',
                       provider          TEXT         NOT NULL DEFAULT 'LOCAL',
                       provider_subject  TEXT,
                       is_organizer      BOOLEAN      NOT NULL DEFAULT FALSE,
                       deleted_at        TIMESTAMPTZ,
                       created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
                       CONSTRAINT users_provider_chk CHECK (provider IN ('LOCAL','GOOGLE')),
                       CONSTRAINT users_role_chk     CHECK (role IN ('USER','ADMIN'))
);

CREATE UNIQUE INDEX users_provider_subject_idx
    ON users (provider, provider_subject) WHERE provider_subject IS NOT NULL;
CREATE INDEX users_deleted_at_idx ON users(deleted_at) WHERE deleted_at IS NULL;