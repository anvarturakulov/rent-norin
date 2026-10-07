ALTER TABLE "docvalues"
ADD COLUMN IF NOT EXISTS "sourceOrderWorkId" BIGINT,
ADD COLUMN IF NOT EXISTS "sourceOrderWorkLogId" BIGINT;

ALTER TABLE "order_work_logs"
ADD COLUMN IF NOT EXISTS "withoutMaterials" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_docvalues_sourceOrderWorkId"
ON "docvalues" ("sourceOrderWorkId")
WHERE "sourceOrderWorkId" IS NOT NULL;
