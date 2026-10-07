-- refvalues: поля амортизации ОС
ALTER TABLE refvalues
  ADD COLUMN IF NOT EXISTS "amortizationCoefficient" DECIMAL(10, 4) NULL,
  ADD COLUMN IF NOT EXISTS "amortizationStartDate" DATE NULL;

COMMENT ON COLUMN refvalues."amortizationCoefficient" IS 'Годовой коэффициент амортизации ОС, %';
COMMENT ON COLUMN refvalues."amortizationStartDate" IS 'Дата начала начисления амортизации';

-- Schet S02 (накопленная амортизация ОС)
DO $$
DECLARE
    col record;
    schet_val text := 'S02';
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
              AND e.enumlabel = schet_val
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, schet_val);
        RAISE NOTICE 'Added % to %.%', schet_val, col.table_name, col.column_name;
    END LOOP;
END $$;

-- DocumentType: AmortizasiyaOS
DO $$
DECLARE
    col record;
    doc_type text := 'AmortizasiyaOS';
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
