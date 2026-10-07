INSERT INTO settings (key, type, value, description, "markToDeleted", "allowedRoles", "enterpriseId", "isPereodic", "createdAt", "updatedAt")
SELECT v.key, v.type::"enum_settings_type", v.value::jsonb, v.description, false, '["ADMINGLOBAL","HEADCOMPANY","HEADGLOBAL"]'::jsonb, NULL, false, NOW(), NOW()
FROM (VALUES
    ('productionReceiptProductChargeId', 'NUMBER', '0', 'ID статьи затрат (CHARGES) — 2-е субконто кредита S20 при приходе готовой продукции с производства'),
    ('productionReceiptHalfstuffChargeId', 'NUMBER', '0', 'ID статьи затрат (CHARGES) — 2-е субконто кредита S20 при приходе полуфабриката с производства')
) AS v(key, type, value, description)
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key AND s."enterpriseId" IS NULL);
