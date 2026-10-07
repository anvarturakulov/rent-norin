INSERT INTO settings (key, type, value, description, "markToDeleted", "allowedRoles", "enterpriseId", "isPereodic", "createdAt", "updatedAt")
SELECT v.key, v.type::"enum_settings_type", v.value::jsonb, v.description, false, '["ADMINGLOBAL","HEADCOMPANY","HEADGLOBAL"]'::jsonb, NULL, v."isPereodic", NOW(), NOW()
FROM (VALUES
    ('toolsRent.mediatorBonusPercent', 'NUMBER', '0', '% бонуса посреднику от себестоимости выданных инструментов (по умолчанию)', true),
    ('toolsRent.mediatorBonusPercent.driver', 'NUMBER', '0', '% бонуса для типа DRIVER (шофёр)', true),
    ('toolsRent.mediatorBonusPercent.master', 'NUMBER', '0', '% бонуса для типа MASTER (мастер)', true),
    ('toolsRent.mediatorBonusMinAmount', 'NUMBER', '0', 'Минимальный порог бонуса (ниже — не начислять)', false),
    ('toolsRent.mediatorExpenseSectionId', 'NUMBER', '0', 'ID цеха/буліма для S20 (1-е субконто)', false),
    ('toolsRent.mediatorChargeId', 'NUMBER', '0', 'ID статьи затрат CHARGES для S20 (2-е субконто)', false)
) AS v(key, type, value, description, "isPereodic")
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key AND s."enterpriseId" IS NULL);
