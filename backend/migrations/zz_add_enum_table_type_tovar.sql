-- enum для doctableitems.tableType: tovar (продажа товаров S29 в ReceiveToolsFromClient)
DO $$
DECLARE
    type_name text;
BEGIN
    SELECT c.udt_name INTO type_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'doctableitems'
      AND c.column_name = 'tableType';

    IF type_name IS NULL THEN
        RAISE NOTICE 'doctableitems.tableType not found, skip';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = 'tovar'
    ) THEN
        RAISE NOTICE 'tovar already in %', type_name;
        RETURN;
    END IF;

    EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, 'tovar');
    RAISE NOTICE 'Added tovar to %', type_name;
END $$;
