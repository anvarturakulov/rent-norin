-- Нормы полуфабрикатов на карточке ГП + снимок в заказе + документ списания

CREATE TABLE IF NOT EXISTS product_halfstuff_norms (
  id BIGSERIAL PRIMARY KEY,
  "referenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  "lineIndex" INTEGER NOT NULL DEFAULT 0,
  "halfstuffId" INTEGER NOT NULL REFERENCES "references"(id),
  price DOUBLE PRECISION,
  "countPlanned" DOUBLE PRECISION,
  total DOUBLE PRECISION,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_halfstuff_norms_reference ON product_halfstuff_norms ("referenceId");

CREATE TABLE IF NOT EXISTS order_halfstuffs (
  id BIGSERIAL PRIMARY KEY,
  "orderId" BIGINT NOT NULL REFERENCES furniture_orders(id) ON DELETE CASCADE,
  "halfstuffId" INTEGER NOT NULL REFERENCES "references"(id),
  price DOUBLE PRECISION,
  "countPlanned" DOUBLE PRECISION,
  "finishedProductQty" DOUBLE PRECISION,
  "countInOrder" DOUBLE PRECISION,
  "countFact" DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION,
  "sourceNormId" BIGINT REFERENCES product_halfstuff_norms(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_halfstuffs_order ON order_halfstuffs ("orderId");

ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "halfstuffWriteoffDocId" BIGINT NULL;
