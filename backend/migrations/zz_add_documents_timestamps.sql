-- Ensure documents table has Sequelize timestamp columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documents'
          AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE documents ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documents'
          AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE documents ADD COLUMN "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;
