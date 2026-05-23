ALTER TABLE users
    ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- Partial index: only indexes live rows, so findByEmailAndDeletedAtIsNull is cheap.
CREATE INDEX users_deleted_at_idx ON users(deleted_at) WHERE deleted_at IS NULL;
