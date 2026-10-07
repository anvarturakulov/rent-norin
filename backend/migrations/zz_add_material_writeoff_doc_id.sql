-- Списание материалов одним документом на этапе Омбор
ALTER TABLE furniture_orders
  ADD COLUMN IF NOT EXISTS "materialWriteoffDocId" BIGINT NULL;
