ALTER TABLE order_stage_history
ADD COLUMN IF NOT EXISTS "eventType" VARCHAR(16) NOT NULL DEFAULT 'STAGE';

ALTER TABLE order_stage_history
ADD COLUMN IF NOT EXISTS "fromDeptId" INTEGER NULL;

ALTER TABLE order_stage_history
ADD COLUMN IF NOT EXISTS "toDeptId" INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_stage_history_fromDeptId_fkey'
    ) THEN
        ALTER TABLE order_stage_history
        ADD CONSTRAINT "order_stage_history_fromDeptId_fkey"
            FOREIGN KEY ("fromDeptId") REFERENCES "references"(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_stage_history_toDeptId_fkey'
    ) THEN
        ALTER TABLE order_stage_history
        ADD CONSTRAINT "order_stage_history_toDeptId_fkey"
            FOREIGN KEY ("toDeptId") REFERENCES "references"(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END $$;

UPDATE order_stage_history
SET "eventType" = 'STAGE'
WHERE "eventType" IS NULL OR "eventType" = '';
