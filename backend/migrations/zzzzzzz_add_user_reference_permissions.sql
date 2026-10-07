-- Права доступа по справочникам для пользователя (индивидуальные настройки)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS "referencePermissions" JSONB;
