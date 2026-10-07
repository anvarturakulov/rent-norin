-- DocumentType: ServicesToClients
DO $$
DECLARE
    col record;
    doc_type text := 'ServicesToClients';
BEGIN
    FOR col IN
        SELECT c.table_name, c.column_name, c.udt_name AS type_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name IN ('documents', 'entries')
          AND c.column_name IN ('documentType', 'documentTypeForSender', 'documentTypeForReceiver')
          AND c.udt_name LIKE 'enum_%'
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = col.type_name
              AND e.enumlabel = doc_type
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, doc_type);
        RAISE NOTICE 'Added % to %.%', doc_type, col.table_name, col.column_name;
    END LOOP;
END $$;

-- TypeReference: SERVICES
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
          AND e.enumlabel = 'SERVICES'
    ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE ''SERVICES''', type_name);
        RAISE NOTICE 'Added SERVICES enum value to type %', type_name;
    ELSE
        RAISE NOTICE 'Enum value SERVICES already exists in type %, skip.', type_name;
    END IF;
END $$;
