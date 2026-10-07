-- Уникальность артикула для STORAGES в рамках enterpriseId (только для заполненных article)
CREATE UNIQUE INDEX IF NOT EXISTS uq_references_storages_article_null_enterprise
    ON "references" ("article")
    WHERE "typeReference" = 'STORAGES'
      AND "enterpriseId" IS NULL
      AND "article" IS NOT NULL
      AND btrim("article") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_references_storages_article_with_enterprise
    ON "references" ("enterpriseId", "article")
    WHERE "typeReference" = 'STORAGES'
      AND "enterpriseId" IS NOT NULL
      AND "article" IS NOT NULL
      AND btrim("article") <> '';
