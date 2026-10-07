-- Статус договора с клиентом

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_client_contracts_status'
    ) THEN
        CREATE TYPE "enum_client_contracts_status" AS ENUM (
            'DRAFT',
            'APPROVED',
            'PRODUCTION',
            'COMPLETED'
        );
    END IF;
END $$;

ALTER TABLE client_contracts
    ADD COLUMN IF NOT EXISTS status "enum_client_contracts_status" NOT NULL DEFAULT 'DRAFT';
