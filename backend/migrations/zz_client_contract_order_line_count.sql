-- Количество в строке заказа договора (цена orderPrice — за единицу)

ALTER TABLE client_contract_order_lines
    ADD COLUMN IF NOT EXISTS count DOUBLE PRECISION NOT NULL DEFAULT 1;
