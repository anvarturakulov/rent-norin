-- Флаг: наценка до себестоимости входит в расчёт costPrice или только информативная
ALTER TABLE pricing_markup_definitions
    ADD COLUMN IF NOT EXISTS "includesInCost" BOOLEAN NOT NULL DEFAULT true;

UPDATE pricing_markup_definitions
SET "includesInCost" = true
WHERE "includesInCost" IS NULL;
