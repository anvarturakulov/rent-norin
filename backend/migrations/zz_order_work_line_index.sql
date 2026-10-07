ALTER TABLE order_works
    ADD COLUMN IF NOT EXISTS "lineIndex" INTEGER NOT NULL DEFAULT 0;

-- Восстановить порядок по текущему id внутри каждой заявки (старые данные)
UPDATE order_works ow
SET "lineIndex" = sub.idx
FROM (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY id) - 1)::int AS idx
    FROM order_works
) sub
WHERE ow.id = sub.id;

CREATE INDEX IF NOT EXISTS "order_works_orderId_lineIndex_idx" ON order_works ("orderId", "lineIndex");
