-- TypeReference: MEDIATORS (посредники)
DO $$
DECLARE
    type_name text;
BEGIN
    -- Find enum type used by references.typeReference
    SELECT t.typname
    INTO type_name
    FROM pg_type t
    WHERE t.typtype = 'e'
      AND EXISTS (
        SELECT 1 FROM pg_enum e WHERE e.enumtypid = t.oid AND e.enumlabel = 'TMZ'
      )
      AND EXISTS (
        SELECT 1 FROM pg_enum e WHERE e.enumtypid = t.oid AND e.enumlabel = 'PARTNERS'
      )
    LIMIT 1;

    IF type_name IS NULL THEN
        RAISE NOTICE 'TypeReference enum type not found, skip.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = type_name
          AND e.enumlabel = 'MEDIATORS'
    ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE ''MEDIATORS''', type_name);
        RAISE NOTICE 'Added MEDIATORS enum value to type %', type_name;
    ELSE
        RAISE NOTICE 'Enum value MEDIATORS already exists in type %, skip.', type_name;
    END IF;
END $$;

-- refvalues.mediatorType enum type + column (Шофёр / Мастер)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_refvalues_mediatorType'
    ) THEN
        CREATE TYPE "enum_refvalues_mediatorType" AS ENUM ('DRIVER', 'MASTER');
        RAISE NOTICE 'Created enum type enum_refvalues_mediatorType';
    END IF;
END $$;

ALTER TABLE refvalues
    ADD COLUMN IF NOT EXISTS "mediatorType" "enum_refvalues_mediatorType";
