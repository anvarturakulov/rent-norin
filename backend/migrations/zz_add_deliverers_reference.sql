-- TypeReference: DELIVERERS (доставщики)
DO $$
DECLARE
    type_name text;
BEGIN
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
          AND e.enumlabel = 'DELIVERERS'
    ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE ''DELIVERERS''', type_name);
        RAISE NOTICE 'Added DELIVERERS enum value to type %', type_name;
    ELSE
        RAISE NOTICE 'Enum value DELIVERERS already exists in type %, skip.', type_name;
    END IF;
END $$;
