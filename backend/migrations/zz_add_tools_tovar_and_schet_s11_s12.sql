-- TypeTMZ: TOOLS (инструменты, аренда), TOVAR (товары)
DO $$
DECLARE
    type_name text;
    tmz_type text;
BEGIN
    SELECT c.udt_name
    INTO type_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'refvalues'
      AND c.column_name = 'typeTMZ'
    LIMIT 1;

    IF type_name IS NULL THEN
        RAISE NOTICE 'refvalues.typeTMZ: column or enum type not found, skip.';
        RETURN;
    END IF;

    FOREACH tmz_type IN ARRAY ARRAY['TOOLS', 'TOVAR']
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = type_name
              AND e.enumlabel = tmz_type
        ) THEN
            RAISE NOTICE 'Enum value % already exists in %, skip.', tmz_type, type_name;
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, tmz_type);
        RAISE NOTICE 'Added % to enum %', tmz_type, type_name;
    END LOOP;
END $$;

-- Schet: S11 (инструменты на складе), S12 (инструменты у клиента)
-- Применяется ко всем enum-колонкам счетов (entries.debet/kredit, stocks.schet, oborots.schet)
DO $$
DECLARE
    col record;
    schet_value text;
BEGIN
    FOREACH schet_value IN ARRAY ARRAY['S11', 'S12']
    LOOP
        FOR col IN
            SELECT c.table_name, c.column_name, c.udt_name AS type_name
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name IN ('entries', 'oborots', 'stocks')
              AND c.column_name IN ('debet', 'kredit', 'schet')
              AND c.udt_name LIKE 'enum_%'
        LOOP
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = col.type_name
                  AND e.enumlabel = schet_value
            ) THEN
                CONTINUE;
            END IF;
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', col.type_name, schet_value);
            RAISE NOTICE 'Added % to %.%', schet_value, col.table_name, col.column_name;
        END LOOP;
    END LOOP;
END $$;
