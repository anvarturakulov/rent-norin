-- Удаление устаревших полей наценок из tmzPricing (перенесены в pricing policy)
UPDATE refvalues
SET "tmzPricing" = CASE
    WHEN ("tmzPricing" - ARRAY[
        'workMarkupPercent',
        'materialMarkupPercent',
        'additionalCost',
        'extraMarkupPercent'
    ]) = '{}'::jsonb THEN NULL
    ELSE "tmzPricing" - ARRAY[
        'workMarkupPercent',
        'materialMarkupPercent',
        'additionalCost',
        'extraMarkupPercent'
    ]
END
WHERE "tmzPricing" IS NOT NULL
  AND (
    "tmzPricing" ? 'workMarkupPercent'
    OR "tmzPricing" ? 'materialMarkupPercent'
    OR "tmzPricing" ? 'additionalCost'
    OR "tmzPricing" ? 'extraMarkupPercent'
  );
