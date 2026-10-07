-- Глобальная ценовая политика: каталог наценок + периодические снимки матрицы
-- Идемпотентно: без DROP TABLE, чтобы повторный migration:run не стирал снимки.

CREATE TABLE IF NOT EXISTS pricing_markup_definitions (
    id SERIAL PRIMARY KEY,
    "group" VARCHAR(32) NOT NULL CHECK ("group" IN ('BEFORE_COST', 'AFTER_COST')),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enterpriseId" INTEGER REFERENCES enterprises(id) ON DELETE SET NULL ON UPDATE CASCADE,
    "markToDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_markup_definitions_code
    ON pricing_markup_definitions (code)
    WHERE "markToDeleted" = false AND "enterpriseId" IS NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_markup_definitions_group
    ON pricing_markup_definitions ("group", "sortOrder");

CREATE TABLE IF NOT EXISTS pricing_policy_snapshots (
    id BIGSERIAL PRIMARY KEY,
    "effectiveDate" BIGINT NOT NULL,
    "enterpriseId" INTEGER REFERENCES enterprises(id) ON DELETE SET NULL ON UPDATE CASCADE,
    comment VARCHAR(500),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_policy_snapshots_enterprise_date
    ON pricing_policy_snapshots ("enterpriseId", "effectiveDate");

CREATE TABLE IF NOT EXISTS pricing_policy_snapshot_values (
    id BIGSERIAL PRIMARY KEY,
    "snapshotId" BIGINT NOT NULL REFERENCES pricing_policy_snapshots(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "markupCode" VARCHAR(64) NOT NULL,
    "percentClassA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentClassB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentClassC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE ("snapshotId", "markupCode")
);

CREATE INDEX IF NOT EXISTS idx_pricing_policy_snapshot_values_snapshot
    ON pricing_policy_snapshot_values ("snapshotId");

INSERT INTO pricing_markup_definitions ("group", code, name, "isSystem", "sortOrder", "enterpriseId", "markToDeleted")
SELECT v."group", v.code, v.name, v."isSystem", v."sortOrder", NULL, false
FROM (VALUES
    ('BEFORE_COST', 'OTHER_EXPENSES', 'Наценка на прочие расходы', true, 10),
    ('BEFORE_COST', 'DESIGNER', 'Наценка на дизайнера', true, 20),
    ('AFTER_COST', 'DEALER', 'Дилерская наценка', true, 30),
    ('AFTER_COST', 'RETAIL', 'Розничная наценка', true, 40),
    ('AFTER_COST', 'TRANSFER', 'Наценка перечисления', true, 50)
) AS v("group", code, name, "isSystem", "sortOrder")
WHERE NOT EXISTS (
    SELECT 1 FROM pricing_markup_definitions d
    WHERE d.code = v.code AND d."enterpriseId" IS NULL AND d."markToDeleted" = false
);
