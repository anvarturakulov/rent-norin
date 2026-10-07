-- Договоры аренды инструментов

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_rental_contracts_status'
    ) THEN
        CREATE TYPE "enum_rental_contracts_status" AS ENUM (
            'DRAFT',
            'APPROVED',
            'COMPLETED',
            'CANCELLED'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS rental_contracts (
    id BIGSERIAL PRIMARY KEY,
    "enterpriseId" INTEGER NULL REFERENCES enterprises(id) ON UPDATE CASCADE ON DELETE SET NULL,
    "clientId" INTEGER NOT NULL REFERENCES "references"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    "contractNumber" VARCHAR(64) NOT NULL,
    "contractDate" BIGINT NOT NULL,
    "endDate" BIGINT NULL,
    status "enum_rental_contracts_status" NOT NULL DEFAULT 'DRAFT',
    comment TEXT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS rental_contracts_ent_num
    ON rental_contracts ("enterpriseId", "contractNumber")
    WHERE "enterpriseId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rental_contracts_num_null_ent
    ON rental_contracts ("contractNumber")
    WHERE "enterpriseId" IS NULL;

CREATE INDEX IF NOT EXISTS rental_contracts_client
    ON rental_contracts ("clientId");

CREATE INDEX IF NOT EXISTS rental_contracts_enterprise
    ON rental_contracts ("enterpriseId");
