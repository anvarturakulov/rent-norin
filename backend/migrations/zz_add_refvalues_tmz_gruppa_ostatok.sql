-- TMZ: ввод начального остатка (внешние имена колонок); не отображается в UI
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "ГруппаАртикул" VARCHAR(255);
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "ОстатокНаНачало" NUMERIC(18, 6);
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "ОстатокСумма" NUMERIC(18, 6);
