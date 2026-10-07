-- Flag: TMZ TOOLS used for partner sublease (not our warehouse stock)
ALTER TABLE refvalues ADD COLUMN IF NOT EXISTS "isSubleaseTool" BOOLEAN DEFAULT FALSE;
