-- Add Unitrade order fields (DOrderObject)
-- Version: 003

ALTER TABLE order_history
    ADD COLUMN IF NOT EXISTS order_condition VARCHAR,
    ADD COLUMN IF NOT EXISTS open_close_flag VARCHAR,
    ADD COLUMN IF NOT EXISTS dtrade VARCHAR,
    ADD COLUMN IF NOT EXISTS note VARCHAR,
    ADD COLUMN IF NOT EXISTS account VARCHAR,
    ADD COLUMN IF NOT EXISTS sub_account VARCHAR;

CREATE INDEX IF NOT EXISTS ix_order_history_account ON order_history (account);
CREATE INDEX IF NOT EXISTS ix_order_history_source ON order_history (source);