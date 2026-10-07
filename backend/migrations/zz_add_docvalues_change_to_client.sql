-- Сдачи клиенту (наличные из кассы) в передаче/возврате инструментов
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "changeToClient" DECIMAL(15, 2);
