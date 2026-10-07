-- Договоры с клиентами (мебель): шапка + две табличные части

CREATE TABLE IF NOT EXISTS client_contracts (
    id BIGSERIAL PRIMARY KEY,
    "enterpriseId" INTEGER NULL REFERENCES enterprises(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "contractNumber" VARCHAR(64) NOT NULL,
    "clientId" INTEGER NOT NULL REFERENCES "references"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    "contractDate" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_contracts_ent_num
    ON client_contracts ("enterpriseId", "contractNumber")
    WHERE "enterpriseId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS client_contracts_num_null_ent
    ON client_contracts ("contractNumber")
    WHERE "enterpriseId" IS NULL;

CREATE TABLE IF NOT EXISTS client_contract_order_lines (
    id BIGSERIAL PRIMARY KEY,
    "contractId" BIGINT NOT NULL REFERENCES client_contracts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "furnitureOrderId" BIGINT NOT NULL REFERENCES furniture_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    "orderPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS client_contract_order_lines_contract
    ON client_contract_order_lines ("contractId");

CREATE TABLE IF NOT EXISTS client_contract_expense_lines (
    id BIGSERIAL PRIMARY KEY,
    "contractId" BIGINT NOT NULL REFERENCES client_contracts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "expenseName" VARCHAR(512) NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS client_contract_expense_lines_contract
    ON client_contract_expense_lines ("contractId");
