-- Переименование стадий заказа: MEETING→SAVDO, APPROVED→TEXNOLOG; добавление PRICING, DOGOVOR
DO $$
DECLARE
    type_name text;
    col record;
    new_label text;
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
        FOREACH new_label IN ARRAY ARRAY['SAVDO', 'PRICING', 'DOGOVOR', 'TEXNOLOG']
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = type_name
                  AND e.enumlabel = new_label
            ) THEN
                EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, new_label);
                RAISE NOTICE 'Added % to enum %', new_label, type_name;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- furniture_orders.currentStage
UPDATE furniture_orders SET "currentStage" = 'SAVDO' WHERE "currentStage" = 'MEETING';
UPDATE furniture_orders SET "currentStage" = 'TEXNOLOG' WHERE "currentStage" = 'APPROVED';

-- order_pipeline_stages.stageName
UPDATE order_pipeline_stages SET "stageName" = 'SAVDO' WHERE "stageName" = 'MEETING';
UPDATE order_pipeline_stages SET "stageName" = 'TEXNOLOG' WHERE "stageName" = 'APPROVED';

-- order_stage_history
UPDATE order_stage_history SET "fromStage" = 'SAVDO' WHERE "fromStage" = 'MEETING';
UPDATE order_stage_history SET "toStage" = 'SAVDO' WHERE "toStage" = 'MEETING';
UPDATE order_stage_history SET "fromStage" = 'TEXNOLOG' WHERE "fromStage" = 'APPROVED';
UPDATE order_stage_history SET "toStage" = 'TEXNOLOG' WHERE "toStage" = 'APPROVED';

-- Вставка PRICING и DOGOVOR перед TEXNOLOG в маршрутах, где их ещё нет
DO $$
DECLARE
    r record;
    tex_seq integer;
    tex_status text;
BEGIN
    FOR r IN
        SELECT DISTINCT "orderId" AS oid
        FROM order_pipeline_stages
        WHERE "stageName" = 'TEXNOLOG'
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM order_pipeline_stages
            WHERE "orderId" = r.oid AND "stageName" = 'PRICING'
        ) THEN
            SELECT "sequence", status::text
            INTO tex_seq, tex_status
            FROM order_pipeline_stages
            WHERE "orderId" = r.oid AND "stageName" = 'TEXNOLOG'
            LIMIT 1;

            UPDATE order_pipeline_stages
            SET "sequence" = "sequence" + 2
            WHERE "orderId" = r.oid AND "sequence" >= tex_seq;

            INSERT INTO order_pipeline_stages ("orderId", "stageName", "sequence", status)
            VALUES
                (r.oid, 'PRICING', tex_seq, 'PENDING'),
                (r.oid, 'DOGOVOR', tex_seq + 1, 'PENDING');

            IF tex_status = 'ACTIVE' THEN
                UPDATE order_pipeline_stages
                SET status = 'ACTIVE', "startedAt" = COALESCE("startedAt", EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
                WHERE "orderId" = r.oid AND "stageName" = 'PRICING';
                UPDATE order_pipeline_stages
                SET status = 'PENDING', "startedAt" = NULL
                WHERE "orderId" = r.oid AND "stageName" = 'TEXNOLOG';
                UPDATE furniture_orders SET "currentStage" = 'PRICING' WHERE id = r.oid AND "currentStage" = 'TEXNOLOG';
            END IF;
        END IF;
    END LOOP;
END $$;
