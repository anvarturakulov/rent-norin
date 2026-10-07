CREATE TABLE IF NOT EXISTS order_work_log_workers (
    id BIGSERIAL PRIMARY KEY,
    "logId" BIGINT NOT NULL REFERENCES order_work_logs(id) ON DELETE CASCADE,
    "workerId" INTEGER NOT NULL REFERENCES "references"(id),
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "countFactShare" DOUBLE PRECISION NULL,
    "calculatedSalaryShare" DOUBLE PRECISION NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_work_log_workers_log_worker
ON order_work_log_workers ("logId", "workerId");

INSERT INTO order_work_log_workers ("logId", "workerId", "sharePercent", "countFactShare", "calculatedSalaryShare", "createdAt", "updatedAt")
SELECT
    owl.id,
    owl."workerId",
    100,
    owl."countFact",
    owl."calculatedSalary",
    NOW(),
    NOW()
FROM order_work_logs owl
WHERE owl."workerId" IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM order_work_log_workers olw
    WHERE olw."logId" = owl.id
      AND olw."workerId" = owl."workerId"
);
