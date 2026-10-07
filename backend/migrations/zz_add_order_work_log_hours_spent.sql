ALTER TABLE order_work_logs ADD COLUMN IF NOT EXISTS "hoursSpent" DOUBLE PRECISION NULL;

UPDATE order_work_logs
SET "hoursSpent" = GREATEST(0, ("finishedAt" - "startedAt") / 3600000.0)
WHERE "hoursSpent" IS NULL
  AND "startedAt" IS NOT NULL
  AND "finishedAt" IS NOT NULL
  AND status IN ('PAUSED', 'FINISHED');

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_work_logs_work_worker_started
ON order_work_logs ("workId", "workerId")
WHERE status = 'STARTED';
