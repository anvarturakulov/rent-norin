-- order_materials: countRate→price, countTotalPlanned→countPlanned, countTotalFact→countFact, +total
-- Идемпотентно: повторный запуск пропускает уже применённые шаги.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = 'order_materials'
          AND a.attname = 'countRate' AND NOT a.attisdropped
    ) THEN
        ALTER TABLE order_materials RENAME COLUMN "countRate" TO "price";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = 'order_materials'
          AND a.attname = 'countTotalPlanned' AND NOT a.attisdropped
    ) THEN
        ALTER TABLE order_materials RENAME COLUMN "countTotalPlanned" TO "countPlanned";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = 'order_materials'
          AND a.attname = 'countTotalFact' AND NOT a.attisdropped
    ) THEN
        ALTER TABLE order_materials RENAME COLUMN "countTotalFact" TO "countFact";
    END IF;
END $$;

ALTER TABLE order_materials
    ADD COLUMN IF NOT EXISTS "total" DOUBLE PRECISION;
