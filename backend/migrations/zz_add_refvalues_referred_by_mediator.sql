ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "referredByMediatorId" INTEGER REFERENCES "references"(id);

CREATE INDEX IF NOT EXISTS refvalues_referred_by_mediator_idx
    ON refvalues ("referredByMediatorId")
    WHERE "referredByMediatorId" IS NOT NULL;
