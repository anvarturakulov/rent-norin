-- Добавление PLASTIK в enum колонки refvalues.typeSection (TypeSECTION)
DO $$
DECLARE
    type_name text;
BEGIN
    SELECT c.udt_name
    INTO type_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'refvalues'
      AND c.column_name = 'typeSection'
    LIMIT 1;

    IF type_name IS NULL THEN
        RAISE NOTICE 'refvalues.typeSection: column or enum type not found, skip.';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = type_name
          AND e.enumlabel = 'PLASTIK'
    ) THEN
        RAISE NOTICE 'Enum value PLASTIK already exists in %, skip.', type_name;
        RETURN;
    END IF;

    EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'PLASTIK');
    RAISE NOTICE 'Added PLASTIK to enum %', type_name;
END $$;
