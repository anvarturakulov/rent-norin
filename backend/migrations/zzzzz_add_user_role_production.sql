-- Добавление роли PRODUCTION в enum users.role
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        WHERE t.typname = 'enum_users_role'
    ) THEN
        ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'PRODUCTION';
    END IF;
END $$;
