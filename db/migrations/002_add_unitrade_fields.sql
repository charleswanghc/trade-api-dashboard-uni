-- Add Unitrade-specific fields
-- Version: 002

ALTER TABLE order_history
    ADD COLUMN IF NOT EXISTS price FLOAT,
    ADD COLUMN IF NOT EXISTS strategy VARCHAR,
    ADD COLUMN IF NOT EXISTS order_type VARCHAR,
    ADD COLUMN IF NOT EXISTS source VARCHAR;

CREATE INDEX IF NOT EXISTS ix_order_history_source ON order_history (source);