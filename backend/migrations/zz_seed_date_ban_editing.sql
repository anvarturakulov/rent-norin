-- Одна глобальная дата запрета редактирования документов (все предприятия).
-- Тип DATE уже есть в enum_settings_type (Sequelize SettingType.DATE).
INSERT INTO settings (key, type, value, description, "markToDeleted", "allowedRoles", "enterpriseId", "isPereodic", "createdAt", "updatedAt")
SELECT v.key, v.type::"enum_settings_type", v.value::jsonb, v.description, false, '["ADMINGLOBAL","HEADCOMPANY","HEADGLOBAL"]'::jsonb, NULL, false, NOW(), NOW()
FROM (VALUES
    ('date_ban_editing', 'DATE', 'null', 'Дата запрета редактирования и проводки документов (одна дата на все предприятия)')
) AS v(key, type, value, description)
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key AND s."enterpriseId" IS NULL);

