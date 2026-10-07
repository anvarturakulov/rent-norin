-- Добавить колонку isPereodic в таблицу settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "isPereodic" BOOLEAN DEFAULT false;

-- Создать таблицу setting_pereodic
CREATE TABLE IF NOT EXISTS setting_pereodic (
    id BIGSERIAL PRIMARY KEY,
    "settingId" INTEGER NOT NULL REFERENCES settings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    date BIGINT NOT NULL,
    value FLOAT NOT NULL,
    "enterpriseId" INTEGER REFERENCES enterprises(id) ON DELETE SET NULL ON UPDATE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setting_pereodic_setting_id ON setting_pereodic("settingId");
CREATE INDEX IF NOT EXISTS idx_setting_pereodic_date ON setting_pereodic("settingId", date);
