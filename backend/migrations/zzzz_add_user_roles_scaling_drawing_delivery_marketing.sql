-- Новые роли приложения (см. UserRoles в user.interface.ts).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        WHERE t.typname = 'enum_users_role'
    ) THEN
        ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'SCALING';
        ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'DRAWING';
        ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'DELIVERY';
        ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'MARKETING';
    END IF;
END $$;
