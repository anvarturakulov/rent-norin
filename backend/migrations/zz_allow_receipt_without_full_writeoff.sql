ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "allowReceiptWithoutFullWriteoff" BOOLEAN NOT NULL DEFAULT false;
