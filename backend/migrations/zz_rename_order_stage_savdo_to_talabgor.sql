-- Переименование стадии заказа: SAVDO → TALABGOR
DO $$
DECLARE
    type_name text;
    col record;
    has_savdo boolean;
    has_talabgor boolean;
BEGIN
    FOR col IN
        SELECT DISTINCT udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('furniture_orders', 'order_pipeline_stages', 'order_stage_history')
          AND column_name IN ('currentStage', 'stageName', 'fromStage', 'toStage')
          AND udt_name LIKE 'enum_%'
    LOOP
        type_name := col.udt_name;

        SELECT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = type_name
              AND e.enumlabel = 'SAVDO'
        ) INTO has_savdo;

        SELECT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = type_name
              AND e.enumlabel = 'TALABGOR'
        ) INTO has_talabgor;

        IF has_savdo AND NOT has_talabgor THEN
            EXECUTE format('ALTER TYPE %I RENAME VALUE %L TO %L', type_name, 'SAVDO', 'TALABGOR');
            RAISE NOTICE 'Renamed SAVDO to TALABGOR in enum %', type_name;
        ELSIF NOT has_talabgor THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'TALABGOR');
            RAISE NOTICE 'Added TALABGOR to enum %', type_name;
        END IF;
    END LOOP;
END $$;
