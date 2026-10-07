-- Formwork (опалубка) role and consumption norm for TMZ TOOLS.
-- formworkKind: PANEL | CORNER_OUTER | CORNER_INNER | LOCK | BRACE | TIE
-- formworkNorm: LOCK — pcs per joint; BRACE — pcs per meter of outer contour per tier; TIE — pcs per panel.
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "formworkKind" VARCHAR(16);
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "formworkNorm" DECIMAL(18, 4);
