-- ТМЦ и услуги в договоре с клиентом + связь с документом реализации

CREATE TABLE IF NOT EXISTS client_contract_item_lines (
    id BIGSERIAL PRIMARY KEY,
    "contractId" BIGINT NOT NULL REFERENCES client_contracts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    "lineKind" VARCHAR(16) NOT NULL,
    "analiticId" INTEGER NOT NULL REFERENCES "references"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    count DOUBLE PRECISION NOT NULL DEFAULT 0,
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    total DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleDocId" BIGINT NULL REFERENCES documents(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS client_contract_item_lines_contract
    ON client_contract_item_lines ("contractId");

CREATE INDEX IF NOT EXISTS client_contract_item_lines_sale
    ON client_contract_item_lines ("saleDocId");

ALTER TABLE client_contract_order_lines
    ADD COLUMN IF NOT EXISTS "saleDocId" BIGINT NULL REFERENCES documents(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_contract_order_lines_sale
    ON client_contract_order_lines ("saleDocId");

ALTER TABLE docvalues
    ADD COLUMN IF NOT EXISTS "clientContractId" BIGINT NULL REFERENCES client_contracts(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE docvalues
    ADD COLUMN IF NOT EXISTS "clientContractLineId" BIGINT NULL;

CREATE INDEX IF NOT EXISTS docvalues_client_contract
    ON docvalues ("clientContractId");
