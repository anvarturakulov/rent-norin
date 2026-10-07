ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS jshshir VARCHAR(14);

UPDATE refvalues
SET jshshir = inn
WHERE "isIndividualPerson" = true AND inn IS NOT NULL AND TRIM(inn) <> '';
