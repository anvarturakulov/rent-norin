-- Схема для справочников реквизитов ТМЗ (выполняется до zz_tmz_attribute_dictionaries.sql)

DO $$
DECLARE
    type_name text;
    val text;
    cname text;
BEGIN
    -- Enum TypeReference
    SELECT t.typname
    INTO type_name
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typtype = 'e'
      AND EXISTS (
        SELECT 1 FROM pg_enum e_tmz
        WHERE e_tmz.enumtypid = t.oid AND e_tmz.enumlabel = 'TMZ'
      )
    LIMIT 1;

    IF type_name IS NOT NULL THEN
        FOREACH val IN ARRAY ARRAY[
            'TMZ_SHORT_NAME', 'TMZ_SIZE', 'TMZ_COLOR', 'TMZ_MANUFACTURE', 'TMZ_UNIT'
        ] LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = type_name AND e.enumlabel = val
            ) THEN
                EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, val);
            END IF;
        END LOOP;
    END IF;

    -- Снять уникальность только по name (constraint и index)
    FOR cname IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = '"references"'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%(name)%'
          AND pg_get_constraintdef(oid) NOT LIKE '%typeReference%'
    LOOP
        EXECUTE format('ALTER TABLE "references" DROP CONSTRAINT IF EXISTS %I', cname);
        RAISE NOTICE 'Dropped constraint %', cname;
    END LOOP;

    EXECUTE 'ALTER TABLE "references" DROP CONSTRAINT IF EXISTS references_name_key1';
    EXECUTE 'ALTER TABLE "references" DROP CONSTRAINT IF EXISTS "references_name_key1"';
    EXECUTE 'ALTER TABLE "references" DROP CONSTRAINT IF EXISTS references_name_key';

    FOR cname IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'references'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%(name)%'
          AND indexdef NOT LIKE '%typeReference%'
          AND indexdef NOT LIKE '%tmzDictKey%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', cname);
        RAISE NOTICE 'Dropped index %', cname;
    END LOOP;
END $$;

ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "shortNameId" INTEGER;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "sizeId" INTEGER;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "colorId" INTEGER;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "manufactureId" INTEGER;
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "unitId" INTEGER;

ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "tmzDictKey" TEXT;

DROP INDEX IF EXISTS uq_references_name_type_enterprise;
DROP INDEX IF EXISTS uq_references_name_type_enterprise_null;
DROP INDEX IF EXISTS uq_references_name_type_enterprise_set;

CREATE UNIQUE INDEX uq_references_name_type_enterprise_null
    ON "references" (name, "typeReference")
    WHERE "tmzDictKey" IS NULL
      AND "enterpriseId" IS NULL;

CREATE UNIQUE INDEX uq_references_name_type_enterprise_set
    ON "references" (name, "typeReference", "enterpriseId")
    WHERE "tmzDictKey" IS NULL
      AND "enterpriseId" IS NOT NULL;

DROP INDEX IF EXISTS uq_references_tmz_dict_key;
CREATE UNIQUE INDEX uq_references_tmz_dict_key
    ON "references" ("tmzDictKey")
    WHERE "tmzDictKey" IS NOT NULL;
