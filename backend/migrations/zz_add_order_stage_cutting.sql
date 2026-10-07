-- Добавление стадии CUTTING в enum этапов заказа
DO $$
DECLARE
    type_name text;
    col record;
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
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = type_name
              AND e.enumlabel = 'CUTTING'
        ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'CUTTING');
            RAISE NOTICE 'Added CUTTING to enum %', type_name;
        END IF;
    END LOOP;
END $$;
