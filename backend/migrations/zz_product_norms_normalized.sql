-- Нормализованные нормы готовой продукции (ТМЗ) + связь со снимком заказа

CREATE TABLE IF NOT EXISTS product_work_norms (
  id BIGSERIAL PRIMARY KEY,
  "referenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  "lineIndex" INTEGER NOT NULL DEFAULT 0,
  "workName" VARCHAR(255) NOT NULL,
  "workArticle" VARCHAR(255),
  unit VARCHAR(64),
  "countInUnit" DOUBLE PRECISION,
  "timeInUnit" DOUBLE PRECISION,
  "salaryInUnit" DOUBLE PRECISION,
  class VARCHAR(64),
  "workCategoryId" INTEGER REFERENCES "references"(id),
  "assignedDeptId" INTEGER REFERENCES "references"(id),
  "salaryRate" DOUBLE PRECISION,
  "countRate" DOUBLE PRECISION,
  "hourRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_work_norms_reference ON product_work_norms ("referenceId");

CREATE TABLE IF NOT EXISTS product_material_norms (
  id BIGSERIAL PRIMARY KEY,
  "referenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  "lineIndex" INTEGER NOT NULL DEFAULT 0,
  "materialId" INTEGER NOT NULL REFERENCES "references"(id),
  price DOUBLE PRECISION,
  "countPlanned" DOUBLE PRECISION,
  total DOUBLE PRECISION,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_material_norms_reference ON product_material_norms ("referenceId");

CREATE TABLE IF NOT EXISTS product_production_routes (
  id BIGSERIAL PRIMARY KEY,
  "referenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  "deptId" INTEGER NOT NULL REFERENCES "references"(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_production_routes_reference ON product_production_routes ("referenceId");

CREATE TABLE IF NOT EXISTS product_components (
  id BIGSERIAL PRIMARY KEY,
  "parentReferenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  "componentReferenceId" INTEGER NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  qty DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE ("parentReferenceId", "componentReferenceId")
);

CREATE INDEX IF NOT EXISTS idx_product_components_parent ON product_components ("parentReferenceId");

ALTER TABLE order_works ADD COLUMN IF NOT EXISTS "sourceNormId" BIGINT REFERENCES product_work_norms(id) ON DELETE SET NULL;
ALTER TABLE order_materials ADD COLUMN IF NOT EXISTS "sourceNormId" BIGINT REFERENCES product_material_norms(id) ON DELETE SET NULL;
ALTER TABLE order_production_queues ADD COLUMN IF NOT EXISTS "sourceRouteId" BIGINT REFERENCES product_production_routes(id) ON DELETE SET NULL;
