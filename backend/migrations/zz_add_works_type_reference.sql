DO $$
DECLARE
    type_name text;
BEGIN
    -- Find enum type used by references.typeReference
    SELECT t.typname
    INTO type_name
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typtype = 'e'
      AND EXISTS (
        SELECT 1
        FROM pg_enum e_tmz
        WHERE e_tmz.enumtypid = t.oid
          AND e_tmz.enumlabel = 'TMZ'
      )
      AND EXISTS (
        SELECT 1
        FROM pg_enum e_workers
        WHERE e_workers.enumtypid = t.oid
          AND e_workers.enumlabel = 'WORKERS'
      )
    LIMIT 1;

    IF type_name IS NULL THEN
        RAISE NOTICE 'TypeReference enum type not found, skip migration.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = type_name
          AND e.enumlabel = 'WORKS'
    ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE ''WORKS''', type_name);
        RAISE NOTICE 'Added WORKS enum value to type %', type_name;
    ELSE
        RAISE NOTICE 'Enum value WORKS already exists in type %, skip.', type_name;
    END IF;
END $$;
