export interface TmzNameParts {
  shortName?: string;
  size?: string;
  color?: string;
  texture?: string;
  manufacture?: string;
}

export function buildTmzDisplayName(parts: TmzNameParts): string {
  return [parts.shortName, parts.size, parts.color, parts.texture, parts.manufacture]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
