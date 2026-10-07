-- Омбор ишлари: приход ГП/ПФ и накладная клиенту по заказу
ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "receiptDocId" BIGINT NULL,
  ADD COLUMN IF NOT EXISTS "saleDocId" BIGINT NULL,
  ADD COLUMN IF NOT EXISTS "requiresClientSale" BOOLEAN DEFAULT TRUE;
