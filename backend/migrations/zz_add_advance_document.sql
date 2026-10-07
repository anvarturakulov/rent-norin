-- Документ Advance, счёт S71, фаза аванса и колонки строки закрытия
DO $$
DECLARE
    col record;
    doc_type text := 'Advance';
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
              AND e.enumlabel = 'S71'
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, 'S71');
        RAISE NOTICE 'Added S71 to %.%', col.table_name, col.column_name;
    END LOOP;
END $$;

ALTER TABLE docvalues
    ADD COLUMN IF NOT EXISTS "advancePhase" VARCHAR(16);

ALTER TABLE doctableitems
    ADD COLUMN IF NOT EXISTS "lineKind" VARCHAR(32);

ALTER TABLE doctableitems
    ADD COLUMN IF NOT EXISTS "lineStorageId" INTEGER;
