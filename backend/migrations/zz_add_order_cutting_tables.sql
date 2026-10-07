CREATE TABLE IF NOT EXISTS order_cutting_issues (
    id BIGSERIAL PRIMARY KEY,
    "orderId" BIGINT NOT NULL REFERENCES furniture_orders(id) ON DELETE CASCADE,
    "enterpriseId" INTEGER,
    "materialId" INTEGER NOT NULL REFERENCES "references"(id),
    length DOUBLE PRECISION NOT NULL,
    width DOUBLE PRECISION NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    comment TEXT,
    "createdByUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cutting_issues_order ON order_cutting_issues("orderId");
CREATE INDEX IF NOT EXISTS idx_order_cutting_issues_enterprise ON order_cutting_issues("enterpriseId");

CREATE TABLE IF NOT EXISTS order_cutting_outputs (
    id BIGSERIAL PRIMARY KEY,
    "orderId" BIGINT NOT NULL REFERENCES furniture_orders(id) ON DELETE CASCADE,
    "enterpriseId" INTEGER,
    "materialId" INTEGER NOT NULL REFERENCES "references"(id),
    length DOUBLE PRECISION NOT NULL,
    width DOUBLE PRECISION NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
    comment TEXT,
    "createdByUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cutting_outputs_order ON order_cutting_outputs("orderId");
CREATE INDEX IF NOT EXISTS idx_order_cutting_outputs_enterprise ON order_cutting_outputs("enterpriseId");
