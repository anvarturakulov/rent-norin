-- Общие работы: нормы на карточке ТМЗ и снимок в заказе + флаги наценок

CREATE TABLE IF NOT EXISTS product_common_work_norms (
  id BIGSERIAL PRIMARY KEY,
  "referenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  "lineIndex" INTEGER NOT NULL DEFAULT 0,
  "commonWorkRefId" INTEGER NULL REFERENCES "references"(id) ON DELETE SET NULL,
  "workName" VARCHAR(255) NOT NULL,
  unit VARCHAR(255) NULL,
  quantity DOUBLE PRECISION NULL DEFAULT 0,
  price DOUBLE PRECISION NULL DEFAULT 0,
  amount DOUBLE PRECISION NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_common_work_norms_reference
  ON product_common_work_norms ("referenceId");

CREATE TABLE IF NOT EXISTS order_common_works (
  id BIGSERIAL PRIMARY KEY,
  "orderId" BIGINT NOT NULL REFERENCES furniture_orders(id) ON DELETE CASCADE,
  "lineIndex" INTEGER NOT NULL DEFAULT 0,
  "commonWorkRefId" INTEGER NULL REFERENCES "references"(id) ON DELETE SET NULL,
  "workName" VARCHAR(255) NOT NULL,
  unit VARCHAR(255) NULL,
  quantity DOUBLE PRECISION NULL DEFAULT 0,
  price DOUBLE PRECISION NULL DEFAULT 0,
  amount DOUBLE PRECISION NULL DEFAULT 0,
  "quantityInOrder" DOUBLE PRECISION NULL DEFAULT 0,
  "amountInOrder" DOUBLE PRECISION NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  "sourceNormId" BIGINT NULL REFERENCES product_common_work_norms(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_common_works_order
  ON order_common_works ("orderId");

ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "disabledBeforeCostMarkupCodes" JSONB NULL;
