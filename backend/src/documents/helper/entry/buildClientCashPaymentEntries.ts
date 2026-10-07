import { Document } from "src/documents/document.model";
import { Schet } from "src/interfaces/report.interface";
import { ReferencesService } from "src/references/references.service";
import type { ResultgetValuesForEntry } from "./getValuesForEntry";

const CHANGE_TO_CLIENT_DESCRIPTION = "кайтим";

const parseNumberOrFallback = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildEntryDescription = (
  shortDescription: string,
  fullDescriptionWithParties: string,
): { description: string; fullDescription: string } => {
  const fullDescription = fullDescriptionWithParties
    ? `${shortDescription} | ${fullDescriptionWithParties}`.substring(0, 255)
    : shortDescription;
  return { description: shortDescription, fullDescription };
};

export type BuildClientCashPaymentEntriesParams = {
  doc: Document;
  clientId: number | null | undefined;
  senderId: number | null | undefined;
  cashFromPartner: number | null | undefined;
  usd: number | null | undefined;
  useNewAccount: boolean;
  descriptionWithParties: string;
  paymentDescription: string;
  errorPrefix: string;
  referencesService: ReferencesService;
};

export const buildClientCashPaymentEntries = async ({
  doc,
  clientId,
  senderId,
  cashFromPartner,
  usd,
  useNewAccount,
  descriptionWithParties,
  paymentDescription,
  errorPrefix,
  referencesService,
}: BuildClientCashPaymentEntriesParams): Promise<
  ResultgetValuesForEntry[] | null
> => {
  const cashPayment = parseNumberOrFallback(doc.docValues?.initialPayment, 0);
  const plasticPayment = parseNumberOrFallback(cashFromPartner, 0);
  const usdAmount = parseNumberOrFallback(usd, 0);
  const currencyRate = parseNumberOrFallback(doc.docValues?.currency, 0);
  const changeToClient = parseNumberOrFallback(
    doc.docValues?.changeToClient,
    0,
  );

  if (
    cashPayment <= 0 &&
    plasticPayment <= 0 &&
    (usdAmount <= 0 || currencyRate <= 0) &&
    changeToClient <= 0
  ) {
    return null;
  }

  let enterpriseId: number | null = doc.enterpriseId ?? null;
  if (!enterpriseId && senderId) {
    const senderRef = await referencesService.getReferenceById(senderId);
    enterpriseId = senderRef?.enterpriseId ?? null;
  }
  if (!enterpriseId) {
    throw new Error(
      `${errorPrefix}: не удалось определить enterpriseId для подбора кассы`,
    );
  }

  const cashSchet = useNewAccount ? Schet.S50 : Schet.S00;
  const entries: ResultgetValuesForEntry[] = [];

  const pushPaymentEntry = (
    storageId: number,
    totalAmount: number,
    entryUsd: number,
  ) => {
    const { description, fullDescription } = buildEntryDescription(
      paymentDescription,
      descriptionWithParties,
    );
    entries.push({
      debet: cashSchet,
      kredit: Schet.S40,
      debetFirstSubcontoId: storageId,
      debetSecondSubcontoId: clientId ?? null,
      kreditFirstSubcontoId: clientId ?? null,
      kreditSecondSubcontoId: storageId,
      count: 0,
      total: totalAmount,
      usd: entryUsd,
      description,
      fullDescription,
    });
  };

  const resolveCashStorageId = async (): Promise<number> => {
    const cashStorage = await referencesService.findCashStorageByEnterpriseId(
      enterpriseId,
      "cash",
    );
    if (!cashStorage) {
      throw new Error(
        `${errorPrefix}: не найдена касса «Накд» (TypeSECTION.CASH)`,
      );
    }
    return cashStorage.id;
  };

  if (cashPayment > 0) {
    pushPaymentEntry(await resolveCashStorageId(), cashPayment, 0);
  }

  if (plasticPayment > 0) {
    const plasticStorage =
      await referencesService.findCashStorageByEnterpriseId(
        enterpriseId,
        "plastic",
      );
    if (!plasticStorage) {
      throw new Error(
        `${errorPrefix}: не найдена касса «Пластик» (TypeSECTION.PLASTIK)`,
      );
    }
    pushPaymentEntry(plasticStorage.id, plasticPayment, 0);
  }

  if (usdAmount > 0 && currencyRate > 0) {
    const foreignStorage =
      await referencesService.findCashStorageByEnterpriseId(
        enterpriseId,
        "foreignCash",
      );
    if (!foreignStorage) {
      throw new Error(
        `${errorPrefix}: не найдена валютная касса (CASH + Валюта х.р)`,
      );
    }
    pushPaymentEntry(foreignStorage.id, currencyRate * usdAmount, usdAmount);
  }

  if (changeToClient > 0) {
    const cashStorageId = await resolveCashStorageId();
    const { description, fullDescription } = buildEntryDescription(
      CHANGE_TO_CLIENT_DESCRIPTION,
      descriptionWithParties,
    );
    entries.push({
      debet: Schet.S40,
      kredit: cashSchet,
      debetFirstSubcontoId: clientId ?? null,
      debetSecondSubcontoId: cashStorageId,
      kreditFirstSubcontoId: cashStorageId,
      kreditSecondSubcontoId: clientId ?? null,
      count: 0,
      total: changeToClient,
      usd: 0,
      description,
      fullDescription,
    });
  }

  return entries.length ? entries : null;
};
