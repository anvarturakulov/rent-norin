ALTER TABLE furniture_orders
    ADD COLUMN IF NOT EXISTS order_type VARCHAR(32);

UPDATE furniture_orders
SET order_type = 'individualPrice'
WHERE order_type IS NULL;
