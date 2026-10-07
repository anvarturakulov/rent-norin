ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "disabledBeforeCostMarkupCodesWorks" JSONB NULL;
