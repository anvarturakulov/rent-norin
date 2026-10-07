export const UZ_PASSPORT_SERIES_RE = /^[A-Z]{2}$/;
export const UZ_PASSPORT_NUMBER_RE = /^\d{7}$/;
export const UZ_PASSPORT_ISSUE_MIN_DATE = "1991-09-01";

export interface UzPassportRefValues {
  isIndividualPerson?: boolean;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
}

export function validateUzPassportFields(
  refValues: UzPassportRefValues,
): string | null {
  if (!refValues.isIndividualPerson) return null;

  const series = (refValues.passportSeries ?? "").trim().toUpperCase();
  if (!UZ_PASSPORT_SERIES_RE.test(series)) {
    return "Паспорт серияси: 2 та лотин ҳарфи (масалан AA)";
  }

  const number = (refValues.passportNumber ?? "").trim();
  if (!UZ_PASSPORT_NUMBER_RE.test(number)) {
    return "Паспорт рақами: 7 та рақам";
  }

  const dateStr = (refValues.passportIssueDate ?? "").trim().slice(0, 10);
  if (!dateStr) {
    return "Паспорт берилган санани киритинг";
  }
  const issueDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(issueDate.getTime())) {
    return "Паспорт берилган сана нотўғри";
  }
  const minDate = new Date(`${UZ_PASSPORT_ISSUE_MIN_DATE}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (issueDate < minDate || issueDate > today) {
    return "Паспорт берилган сана нотўғри";
  }

  const issuedBy = (refValues.passportIssuedBy ?? "").trim();
  if (issuedBy.length < 3 || issuedBy.length > 500) {
    return "«Ким томонидан берилган» майдонини тулдиринг";
  }

  return null;
}

export function normalizePassportSeriesInput(value: string): string {
  return value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
}

export function normalizePassportNumberInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 7);
}
