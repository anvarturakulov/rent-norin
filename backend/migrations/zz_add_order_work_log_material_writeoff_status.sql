ALTER TABLE order_work_log_materials
ADD COLUMN IF NOT EXISTS "writeOffStatus" VARCHAR(20) NOT NULL DEFAULT 'NOT_CREATED';

UPDATE order_work_log_materials
SET "writeOffStatus" = CASE
  WHEN "leaveMaterialDocId" IS NOT NULL THEN 'CREATED'
  ELSE 'NOT_CREATED'
END
WHERE "writeOffStatus" IS NULL
   OR "writeOffStatus" = '';
