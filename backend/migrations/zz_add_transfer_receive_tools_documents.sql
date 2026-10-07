-- DocumentType: TransferToolsToClient, ReceiveToolsFromClient
DO $$
DECLARE
    col record;
    doc_type text;
BEGIN
    FOREACH doc_type IN ARRAY ARRAY['TransferToolsToClient', 'ReceiveToolsFromClient']
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

-- docValues: поля для передачи/приёма инструментов
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "settlementDate" BIGINT;
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "mediatorId" INTEGER;
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "returnDateTime" BIGINT;
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "cashReceived" DECIMAL(15, 2);
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "plasticReceived" DECIMAL(15, 2);
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "debtSum" DECIMAL(15, 2);
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "debtComment" VARCHAR(255);

-- docTableItems: тарифы и привязка к партии
ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "hourlyTariff" FLOAT;
ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "dailyRent" FLOAT;
ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "sourceTransferDocId" BIGINT;
ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "rentSum" FLOAT;
