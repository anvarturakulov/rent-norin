-- Заказ как сквозная аналитика в проводках (для отчёта прибыли по заказам).
-- Пустой orderId (NULL) = общие/накладные расходы.

ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS "orderId" BIGINT NULL;

ALTER TABLE oborots
    ADD COLUMN IF NOT EXISTS "orderId" BIGINT NULL;

-- Внешние ключи на furniture_orders (идемпотентно)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entries_orderId_fkey'
    ) THEN
        ALTER TABLE entries
            ADD CONSTRAINT "entries_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES furniture_orders (id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'oborots_orderId_fkey'
    ) THEN
        ALTER TABLE oborots
            ADD CONSTRAINT "oborots_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES furniture_orders (id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Индексы для агрегации расходов по 20 счёту в разрезе заказа
CREATE INDEX IF NOT EXISTS "entries_orderId_debet_idx" ON entries ("orderId", debet);
CREATE INDEX IF NOT EXISTS "oborots_orderId_debet_idx" ON oborots ("orderId", debet);
