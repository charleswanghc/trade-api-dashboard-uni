-- Migration: Add auto_rollover column to strategy_config
-- Description: When auto_rollover=TRUE, target_product is treated as base product code (e.g. MXF)
--              and the system automatically appends the current front-month contract suffix.
--              TAIFEX month codes: A=Jan, B=Feb, C=Mar, D=Apr, E=May, F=Jun,
--                                  G=Jul, H=Aug, I=Sep, J=Oct, K=Nov, L=Dec
--              Expiry: third Wednesday of each month.

ALTER TABLE strategy_config
    ADD COLUMN IF NOT EXISTS auto_rollover BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN strategy_config.auto_rollover IS
    '自動換月：TRUE 時 target_product 為商品基底代碼（如 MXF），系統自動補上近月月份+年份代碼';
