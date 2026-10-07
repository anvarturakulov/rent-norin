ALTER TABLE refvalues
    ADD COLUMN IF NOT EXISTS "allowedProductionDeptIds" JSONB;
