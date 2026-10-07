-- Заполнение *Id из текущих данных ТМЗ (схема: zz_tmz_attribute_dict_schema.sql)

-- Сброс данных от старого обхода ОС (color = 'кора')
UPDATE refvalues rv
SET color = NULL, "colorId" = NULL
FROM "references" r
WHERE rv."referenceId" = r.id
  AND r."typeReference"::text = 'TMZ'
  AND rv."typeTMZ"::text = 'OS'
  AND rv.color = 'кора';

CREATE OR REPLACE FUNCTION pg_temp.tmz_dict_find_or_create(
    p_type text,
    p_name text,
    p_enterprise_id integer,
    p_type_ref_udt text,
    p_type_tmz text DEFAULT NULL,
    p_type_tmz_udt text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_id integer;
    v_trim text;
    v_dict_key text;
BEGIN
    v_trim := btrim(p_name);
    IF v_trim = '' OR p_type_ref_udt IS NULL OR p_type_ref_udt = '' THEN
        RETURN NULL;
    END IF;

    IF p_type = 'TMZ_SHORT_NAME' THEN
        IF p_type_tmz IS NULL OR p_type_tmz = '' THEN
            RETURN NULL;
        END IF;
        v_dict_key :=
            'TMZ_SHORT_NAME' || E'\x1f' ||
            p_type_tmz || E'\x1f' ||
            COALESCE(p_enterprise_id::text, 'null') || E'\x1f' ||
            lower(v_trim);

        SELECT r.id INTO v_id
        FROM "references" r
        WHERE r."tmzDictKey" = v_dict_key
        LIMIT 1;

        IF v_id IS NULL THEN
            SELECT r.id INTO v_id
            FROM "references" r
            JOIN refvalues rv ON rv."referenceId" = r.id
            WHERE r."typeReference"::text = p_type
              AND COALESCE(r."isFolder", false) = false
              AND COALESCE(r."enterpriseId", -1) = COALESCE(p_enterprise_id, -1)
              AND r.name = v_trim
              AND rv."typeTMZ"::text = p_type_tmz
            LIMIT 1;

            IF v_id IS NOT NULL THEN
                UPDATE "references" SET "tmzDictKey" = v_dict_key
                WHERE id = v_id AND "tmzDictKey" IS NULL;
            END IF;
        END IF;
    ELSE
        SELECT r.id INTO v_id
        FROM "references" r
        WHERE r."typeReference"::text = p_type
          AND COALESCE(r."isFolder", false) = false
          AND COALESCE(r."enterpriseId", -1) = COALESCE(p_enterprise_id, -1)
          AND r.name = v_trim
        LIMIT 1;
    END IF;

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    BEGIN
        IF p_type = 'TMZ_SHORT_NAME' THEN
            EXECUTE format(
                'INSERT INTO "references" (name, "typeReference", "parentId", "isFolder", "enterpriseId", "tmzDictKey", "createdAt", "updatedAt")
                 VALUES ($1, $2::%I, NULL, false, $3, $4, NOW(), NOW())
                 RETURNING id',
                p_type_ref_udt
            )
            USING v_trim, p_type, p_enterprise_id, v_dict_key
            INTO v_id;
        ELSE
            EXECUTE format(
                'INSERT INTO "references" (name, "typeReference", "parentId", "isFolder", "enterpriseId", "createdAt", "updatedAt")
                 VALUES ($1, $2::%I, NULL, false, $3, NOW(), NOW())
                 RETURNING id',
                p_type_ref_udt
            )
            USING v_trim, p_type, p_enterprise_id
            INTO v_id;
        END IF;
    EXCEPTION
        WHEN unique_violation THEN
            IF p_type = 'TMZ_SHORT_NAME' AND v_dict_key IS NOT NULL THEN
                SELECT r.id INTO v_id FROM "references" r WHERE r."tmzDictKey" = v_dict_key LIMIT 1;
            END IF;
            IF v_id IS NULL THEN
                SELECT r.id INTO v_id
                FROM "references" r
                WHERE r."typeReference"::text = p_type
                  AND r.name = v_trim
                  AND COALESCE(r."enterpriseId", -1) = COALESCE(p_enterprise_id, -1)
                LIMIT 1;
            END IF;
            IF v_id IS NULL THEN
                RETURN NULL;
            END IF;
            RETURN v_id;
    END;

    IF NOT EXISTS (SELECT 1 FROM refvalues WHERE "referenceId" = v_id) THEN
        IF p_type = 'TMZ_SHORT_NAME' AND p_type_tmz IS NOT NULL AND p_type_tmz_udt IS NOT NULL THEN
            EXECUTE format(
                'INSERT INTO refvalues ("referenceId", "typeTMZ", "createdAt", "updatedAt") VALUES ($1, $2::%I, NOW(), NOW())',
                p_type_tmz_udt
            ) USING v_id, p_type_tmz;
        ELSE
            INSERT INTO refvalues ("referenceId", "createdAt", "updatedAt")
            VALUES (v_id, NOW(), NOW());
        END IF;
    END IF;

    RETURN v_id;
END;
$$;

DO $$
DECLARE
    rec RECORD;
    v_short text;
    v_dict_id integer;
    v_sn_id integer;
    v_sz_id integer;
    v_cl_id integer;
    v_mf_id integer;
    v_un_id integer;
    v_type_tmz_udt text;
    v_type_ref_udt text;
BEGIN
    SELECT c.udt_name INTO v_type_tmz_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'refvalues' AND c.column_name = 'typeTMZ'
    LIMIT 1;

    SELECT c.udt_name INTO v_type_ref_udt
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'references' AND c.column_name = 'typeReference'
    LIMIT 1;

    IF v_type_ref_udt IS NULL THEN
        RAISE EXCEPTION 'references.typeReference column type not found';
    END IF;

    FOR rec IN
        SELECT
            r.id AS ref_id,
            r.name AS tmz_name,
            r."enterpriseId" AS ent_id,
            rv."typeTMZ"::text AS type_tmz,
            rv."shortName",
            rv.size,
            rv.color,
            rv.manufacture,
            rv.unit
        FROM "references" r
        JOIN refvalues rv ON rv."referenceId" = r.id
        WHERE r."typeReference"::text = 'TMZ'
          AND COALESCE(r."isFolder", false) = false
    LOOP
        v_sn_id := NULL;
        v_sz_id := NULL;
        v_cl_id := NULL;
        v_mf_id := NULL;
        v_un_id := NULL;

        IF rec.type_tmz = 'OS' THEN
            v_short := COALESCE(NULLIF(btrim(rec."shortName"), ''), NULLIF(btrim(rec.tmz_name), ''));
        ELSE
            v_short := NULLIF(btrim(rec."shortName"), '');
        END IF;

        IF v_short IS NOT NULL THEN
            v_dict_id := pg_temp.tmz_dict_find_or_create(
                'TMZ_SHORT_NAME', v_short, rec.ent_id, v_type_ref_udt, rec.type_tmz, v_type_tmz_udt
            );
            v_sn_id := v_dict_id;
        END IF;

        IF rec.type_tmz <> 'OS' THEN
            IF NULLIF(btrim(rec.size), '') IS NOT NULL THEN
                v_sz_id := pg_temp.tmz_dict_find_or_create(
                    'TMZ_SIZE', rec.size, rec.ent_id, v_type_ref_udt, NULL, NULL
                );
            END IF;
            IF NULLIF(btrim(rec.color), '') IS NOT NULL THEN
                v_cl_id := pg_temp.tmz_dict_find_or_create(
                    'TMZ_COLOR', rec.color, rec.ent_id, v_type_ref_udt, NULL, NULL
                );
            END IF;
            IF NULLIF(btrim(rec.manufacture), '') IS NOT NULL THEN
                v_mf_id := pg_temp.tmz_dict_find_or_create(
                    'TMZ_MANUFACTURE', rec.manufacture, rec.ent_id, v_type_ref_udt, NULL, NULL
                );
            END IF;
        END IF;

        IF NULLIF(btrim(rec.unit), '') IS NOT NULL THEN
            v_un_id := pg_temp.tmz_dict_find_or_create(
                'TMZ_UNIT', rec.unit, rec.ent_id, v_type_ref_udt, NULL, NULL
            );
        END IF;

        UPDATE refvalues
        SET
            "shortNameId" = COALESCE(v_sn_id, "shortNameId"),
            "sizeId" = COALESCE(v_sz_id, "sizeId"),
            "colorId" = COALESCE(v_cl_id, "colorId"),
            "manufactureId" = COALESCE(v_mf_id, "manufactureId"),
            "unitId" = COALESCE(v_un_id, "unitId"),
            "shortName" = CASE
                WHEN rec.type_tmz = 'OS'
                     AND (rec."shortName" IS NULL OR btrim(rec."shortName") = '')
                     AND v_short IS NOT NULL
                THEN v_short
                ELSE "shortName"
            END
        WHERE "referenceId" = rec.ref_id;
    END LOOP;
END $$;
