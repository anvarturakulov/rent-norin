-- Sublease tools: document types, S13, PARTNER_TOOLS, columns, batch tables
DO $$
DECLARE
    col record;
    doc_type text;
BEGIN
    FOREACH doc_type IN ARRAY ARRAY['TransferSubleaseToolsToClient', 'ReceiveSubleaseToolsFromClient']
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

-- Schet S13
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
              AND e.enumlabel = 'S13'
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, 'S13');
        RAISE NOTICE 'Added S13 to %.%', col.table_name, col.column_name;
    END LOOP;
END $$;

-- TypeSECTION PARTNER_TOOLS
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
          AND e.enumlabel = 'PARTNER_TOOLS'
    ) THEN
        RAISE NOTICE 'Enum value PARTNER_TOOLS already exists in %, skip.', type_name;
        RETURN;
    END IF;

    EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'PARTNER_TOOLS');
    RAISE NOTICE 'Added PARTNER_TOOLS to enum %', type_name;
END $$;

ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "partnerId" INTEGER;
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "partnerId" INTEGER;

ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "partnerHourlyTariff" FLOAT;
ALTER TABLE doctableitems ADD COLUMN IF NOT EXISTS "partnerRentSum" FLOAT;

CREATE TABLE IF NOT EXISTS sublease_tool_open_batches (
    id BIGSERIAL PRIMARY KEY,
    "enterpriseId" INTEGER NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "partnerStorageId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "transferDocId" BIGINT NOT NULL,
    "transferTableItemId" BIGINT,
    "toolId" INTEGER NOT NULL,
    "initialQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementDate" BIGINT NOT NULL,
    "hourlyTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partnerHourlyTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sublease_tool_open_batches_transfer_line_uidx
    ON sublease_tool_open_batches ("transferDocId", "transferTableItemId")
    WHERE "transferTableItemId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS sublease_tool_open_batches_transfer_doc_idx
    ON sublease_tool_open_batches ("transferDocId");

CREATE INDEX IF NOT EXISTS sublease_tool_open_batches_client_open_idx
    ON sublease_tool_open_batches ("enterpriseId", "clientId")
    WHERE "openQty" > 0;

CREATE INDEX IF NOT EXISTS sublease_tool_open_batches_partner_open_idx
    ON sublease_tool_open_batches ("enterpriseId", "partnerId")
    WHERE "openQty" > 0;

CREATE TABLE IF NOT EXISTS sublease_tool_batch_consumptions (
    id BIGSERIAL PRIMARY KEY,
    "receiveDocId" BIGINT NOT NULL,
    "receiveTableItemId" BIGINT,
    "batchId" BIGINT NOT NULL REFERENCES sublease_tool_open_batches (id) ON DELETE RESTRICT,
    qty DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tableType" VARCHAR(16) NOT NULL DEFAULT 'return',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sublease_tool_batch_consumptions_receive_doc_idx
    ON sublease_tool_batch_consumptions ("receiveDocId");

CREATE INDEX IF NOT EXISTS sublease_tool_batch_consumptions_batch_idx
    ON sublease_tool_batch_consumptions ("batchId");
