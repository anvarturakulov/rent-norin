export const UZ_JSHSHIR_RE = /^\d{14}$/;

export interface UzJshshirRefValues {
  isIndividualPerson?: boolean;
  jshshir?: string;
}

export function validateUzJshshirFields(
  refValues: UzJshshirRefValues,
): string | null {
  if (!refValues.isIndividualPerson) return null;

  const jshshir = (refValues.jshshir ?? "").trim();
  if (!UZ_JSHSHIR_RE.test(jshshir)) {
    return "ЖШШИР: 14 та рақам";
  }

  return null;
}

export function normalizeJshshirInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}
