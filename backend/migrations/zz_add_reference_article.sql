ALTER TABLE "references"
    ADD COLUMN IF NOT EXISTS "article" VARCHAR(15);

-- Уникальность артикула для TMZ в рамках enterpriseId (только для заполненных article)
CREATE UNIQUE INDEX IF NOT EXISTS uq_references_tmz_article_null_enterprise
    ON "references" ("article")
    WHERE "typeReference" = 'TMZ'
      AND "enterpriseId" IS NULL
      AND "article" IS NOT NULL
      AND btrim("article") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_references_tmz_article_with_enterprise
    ON "references" ("enterpriseId", "article")
    WHERE "typeReference" = 'TMZ'
      AND "enterpriseId" IS NOT NULL
      AND "article" IS NOT NULL
      AND btrim("article") <> '';
