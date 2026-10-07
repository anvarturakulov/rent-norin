-- Переназначение удалённых ролей приложения (WORKER, HEADGROUP).
-- Идемпотентно: повторный запуск не меняет уже обновлённых строк.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
    UPDATE users SET role = 'MANAGER'::enum_users_role WHERE role::text = 'WORKER';
    UPDATE users SET role = 'HEADCOMPANY'::enum_users_role WHERE role::text = 'HEADGROUP';
  END IF;
END $$;
