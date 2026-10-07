-- Справочник реквизита ТМЗ "текстура" (TMZ_TEXTURE)
-- Идемпотентно: значение enum TypeReference + колонки texture / textureId в refvalues.

DO $$
DECLARE
    type_name text;
BEGIN
    -- Имя enum-типа, в котором есть значение 'TMZ'
    SELECT t.typname
    INTO type_name
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typtype = 'e'
      AND EXISTS (
        SELECT 1 FROM pg_enum e_tmz
        WHERE e_tmz.enumtypid = t.oid AND e_tmz.enumlabel = 'TMZ'
      )
    LIMIT 1;

    IF type_name IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = type_name AND e.enumlabel = 'TMZ_TEXTURE'
        ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'TMZ_TEXTURE');
        END IF;
    END IF;
END $$;

ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "texture" VARCHAR(255);
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "textureId" INTEGER;
