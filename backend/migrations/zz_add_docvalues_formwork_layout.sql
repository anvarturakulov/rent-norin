-- Foundation sketch + formwork calculation result stored on rental documents.
ALTER TABLE docvalues ADD COLUMN IF NOT EXISTS "formworkLayout" JSONB;
