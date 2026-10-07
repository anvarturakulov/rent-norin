ALTER TABLE furniture_orders
    ADD COLUMN IF NOT EXISTS "orderDate" BIGINT,
    ADD COLUMN IF NOT EXISTS "analiticId" INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'furniture_orders'
          AND tc.constraint_name = 'furniture_orders_analiticId_fkey'
    ) THEN
        ALTER TABLE furniture_orders
            ADD CONSTRAINT "furniture_orders_analiticId_fkey"
            FOREIGN KEY ("analiticId") REFERENCES "references"(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;
