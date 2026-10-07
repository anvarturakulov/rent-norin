-- Класс цен для готовой продукции (ТМЗ PRODUCT): A, B, C

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_refvalues_priceClass'
    ) THEN
        CREATE TYPE "enum_refvalues_priceClass" AS ENUM (
            'A',
            'B',
            'C'
        );
    END IF;
END $$;

ALTER TABLE refvalues
    ADD COLUMN IF NOT EXISTS "priceClass" "enum_refvalues_priceClass";
