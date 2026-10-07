-- enum для doctableitems.tableType: return, brak, sale (ReceiveToolsFromClient)
DO $$
DECLARE
    type_name text;
    enum_val text;
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

    FOREACH enum_val IN ARRAY ARRAY['return', 'brak', 'sale']
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = type_name AND e.enumlabel = enum_val
        ) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, enum_val);
        RAISE NOTICE 'Added % to %', enum_val, type_name;
    END LOOP;
END $$;
