-- Восстановление стадии TEXNOLOG в маршруте заявок, созданных пока этап был скрыт.
-- Затрагивает individualPrice заявки с производственными этапами (CUTTING / IN_PRODUCTION),
-- у которых TEXNOLOG отсутствует в order_pipeline_stages.

DO $$
DECLARE
    r record;
    anchor_seq integer;
    anchor_stage text;
    tex_status text;
    order_current text;
BEGIN
    FOR r IN
        SELECT fo.id AS oid
        FROM furniture_orders fo
        WHERE COALESCE(fo.order_type, 'individualPrice') = 'individualPrice'
          AND NOT EXISTS (
              SELECT 1
              FROM order_pipeline_stages ops
              WHERE ops."orderId" = fo.id
                AND ops."stageName" = 'TEXNOLOG'
          )
          AND EXISTS (
              SELECT 1
              FROM order_pipeline_stages ops
              WHERE ops."orderId" = fo.id
                AND ops."stageName" IN ('CUTTING', 'IN_PRODUCTION')
          )
    LOOP
        SELECT ops."sequence", ops."stageName"
        INTO anchor_seq, anchor_stage
        FROM order_pipeline_stages ops
        WHERE ops."orderId" = r.oid
          AND ops."stageName" IN ('CUTTING', 'IN_PRODUCTION')
        ORDER BY ops."sequence" ASC
        LIMIT 1;

        IF anchor_seq IS NULL THEN
            CONTINUE;
        END IF;

        SELECT fo."currentStage"::text
        INTO order_current
        FROM furniture_orders fo
        WHERE fo.id = r.oid;

        IF order_current = 'TEXNOLOG' THEN
            tex_status := 'ACTIVE';
        ELSIF order_current IN ('CUTTING', 'IN_PRODUCTION', 'STORE', 'DELIVERY', 'COMPLETED') THEN
            tex_status := 'DONE';
        ELSE
            tex_status := 'PENDING';
        END IF;

        UPDATE order_pipeline_stages
        SET "sequence" = "sequence" + 1
        WHERE "orderId" = r.oid
          AND "sequence" >= anchor_seq;

        INSERT INTO order_pipeline_stages ("orderId", "stageName", "sequence", status)
        VALUES (r.oid, 'TEXNOLOG', anchor_seq, tex_status);

        RAISE NOTICE 'Restored TEXNOLOG for order % before % (status=%)', r.oid, anchor_stage, tex_status;
    END LOOP;
END $$;
