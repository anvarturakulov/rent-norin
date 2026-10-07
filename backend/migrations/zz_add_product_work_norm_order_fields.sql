-- Добавляем поля workRefId, countInOrder, timeInOrder, salaryInOrder в product_work_norms
ALTER TABLE product_work_norms
  ADD COLUMN IF NOT EXISTS "workRefId" BIGINT NULL,
  ADD COLUMN IF NOT EXISTS "countInOrder" FLOAT NULL,
  ADD COLUMN IF NOT EXISTS "timeInOrder" FLOAT NULL,
  ADD COLUMN IF NOT EXISTS "salaryInOrder" FLOAT NULL;
