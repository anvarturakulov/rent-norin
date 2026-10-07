CREATE TABLE IF NOT EXISTS client_tool_open_batches (
    id BIGSERIAL PRIMARY KEY,
    "enterpriseId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "transferDocId" BIGINT NOT NULL,
    "transferTableItemId" BIGINT,
    "toolId" INTEGER NOT NULL,
    "initialQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlementDate" BIGINT NOT NULL,
    "hourlyTariff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_tool_open_batches_transfer_line_uidx
    ON client_tool_open_batches ("transferDocId", "transferTableItemId")
    WHERE "transferTableItemId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_tool_open_batches_transfer_doc_idx
    ON client_tool_open_batches ("transferDocId");

CREATE INDEX IF NOT EXISTS client_tool_open_batches_client_open_idx
    ON client_tool_open_batches ("enterpriseId", "clientId")
    WHERE "openQty" > 0;

CREATE TABLE IF NOT EXISTS client_tool_batch_consumptions (
    id BIGSERIAL PRIMARY KEY,
    "receiveDocId" BIGINT NOT NULL,
    "receiveTableItemId" BIGINT,
    "batchId" BIGINT NOT NULL REFERENCES client_tool_open_batches (id) ON DELETE RESTRICT,
    qty DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tableType" VARCHAR(16) NOT NULL DEFAULT 'return',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_tool_batch_consumptions_receive_doc_idx
    ON client_tool_batch_consumptions ("receiveDocId");

CREATE INDEX IF NOT EXISTS client_tool_batch_consumptions_batch_idx
    ON client_tool_batch_consumptions ("batchId");
