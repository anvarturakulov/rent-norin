-- Тип тарифа аренды на передаче инструментов: CASH (firstPrice) или TRANSFER (thirdPrice)
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "rentTariffType" VARCHAR(16);
