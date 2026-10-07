-- Schet: S93 (прочие доходы / бошқа даромад)
DO $$
DECLARE
    col record;
BEGIN
    FOR col IN
        SELECT c.table_name, c.column_name, c.udt_name AS type_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name IN ('entries', 'oborots', 'stocks')
          AND c.column_name IN ('debet', 'kredit', 'schet')
          AND c.udt_name LIKE 'enum_%'
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = col.type_name
              AND e.enumlabel = 'S93'
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, 'S93');
        RAISE NOTICE 'Added S93 to %.%', col.table_name, col.column_name;
    END LOOP;
END $$;
