-- Публичный каталог: флаг на сайте, описание для витрины, доп. фото (до 3 всего с imagePath)
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "showOnWebsite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "websiteDescription" TEXT;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "imagePath2" VARCHAR(255);
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "imagePath3" VARCHAR(255);
