export const UZ_BANK_ACCOUNT_RE = /^\d{20}$/;
export const UZ_BANK_MFO_RE = /^\d{5}$/;
export const UZ_INN_RE = /^\d{9}$/;

export interface UzLegalEntityRefValues {
  isLegalEntity?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankMfo?: string;
  inn?: string;
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

  const inn = (refValues.inn ?? "").trim();
  if (!UZ_INN_RE.test(inn)) {
    return "ИНН: 9 та рақам";
  }

  return null;
}

export function normalizeBankAccountInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 20);
}

export function normalizeBankMfoInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function normalizeInnInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}
