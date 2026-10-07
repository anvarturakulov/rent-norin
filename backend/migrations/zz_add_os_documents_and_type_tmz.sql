-- TypeTMZ: OS (основные средства)
DO $$
DECLARE
    type_name text;
BEGIN
    SELECT c.udt_name
    INTO type_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'refvalues'
      AND c.column_name = 'typeTMZ'
    LIMIT 1;

    IF type_name IS NULL THEN
        RAISE NOTICE 'refvalues.typeTMZ: column or enum type not found, skip.';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = type_name
          AND e.enumlabel = 'OS'
    ) THEN
        RAISE NOTICE 'Enum value OS already exists in %, skip.', type_name;
        RETURN;
    END IF;

    EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'OS');
    RAISE NOTICE 'Added OS to enum %', type_name;
END $$;

-- DocumentType: ComeOS, LeaveOS, MoveOS, SaleOS
DO $$
DECLARE
    col record;
    doc_type text;
BEGIN
    FOREACH doc_type IN ARRAY ARRAY['ComeOS', 'LeaveOS', 'MoveOS', 'SaleOS']
    LOOP
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
    END LOOP;
END $$;
