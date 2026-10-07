export const UZ_BANK_ACCOUNT_RE = /^\d{20}$/;
export const UZ_BANK_MFO_RE = /^\d{5}$/;

export interface UzLegalEntityRefValues {
  isLegalEntity?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankMfo?: string;
}

export function validateUzLegalEntityFields(
  refValues: UzLegalEntityRefValues,
): string | null {
  if (!refValues.isLegalEntity) return null;

  const bankName = (refValues.bankName ?? "").trim();
  if (bankName.length < 2 || bankName.length > 255) {
    return "Банк номини киритинг";
  }

  const bankAccount = (refValues.bankAccount ?? "").trim();
  if (!UZ_BANK_ACCOUNT_RE.test(bankAccount)) {
    return "Ҳисоб рақами: 20 та рақам";
  }

  const bankMfo = (refValues.bankMfo ?? "").trim();
  if (!UZ_BANK_MFO_RE.test(bankMfo)) {
    return "МФО: 5 та рақам";
  }

  return null;
}
