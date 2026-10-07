import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { Schet } from "src/interfaces/report.interface";
import { ReferencesService } from "src/references/references.service";

const REMAIND_DATE = 1735671599000;

export const ADVANCE_PHASE = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  CLOSED: "CLOSED",
} as const;

export type AdvanceLineKind =
  | "expense"
  | "client"
  | "partner"
  | "worker"
  | "mediator"
  | "deliverer"
  | "founder";

const LINE_KINDS = new Set<AdvanceLineKind>([
  "expense",
  "client",
  "partner",
  "worker",
  "mediator",
  "deliverer",
  "founder",
]);

const round2 = (value: number): number => Math.round(value * 100) / 100;

const moneyEquals = (left: number, right: number): boolean =>
  Math.abs(round2(left) - round2(right)) < 0.01;

const cashSchet = (docDate: bigint | number): Schet =>
  Number(docDate) > REMAIND_DATE ? Schet.S50 : Schet.S00;

const filledLines = (doc: Document): DocTableItems[] =>
  (doc.docTableItems || []).filter((line) => {
    const kind = String((line as DocTableItems & { lineKind?: string }).lineKind || "");
    return LINE_KINDS.has(kind as AdvanceLineKind) && Number(line.total) > 0;
  });

const debitOfLine = (
  kind: AdvanceLineKind,
  analiticId: number | null,
  storageId: number | null,
  cashId: number,
): {
  debet: Schet;
  debetFirstSubcontoId: number | null;
  debetSecondSubcontoId: number | null;
  debetThirdSubcontoId: number | null;
} => {
  if (kind === "expense") {
    return {
      debet: Schet.S20,
      debetFirstSubcontoId: storageId,
      debetSecondSubcontoId: analiticId,
      debetThirdSubcontoId: null,
    };
  }
  if (kind === "client") {
    return {
      debet: Schet.S40,
      debetFirstSubcontoId: analiticId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
    };
  }
  if (kind === "partner") {
    return {
      debet: Schet.S60,
      debetFirstSubcontoId: analiticId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
    };
  }
  if (kind === "worker") {
    return {
      debet: Schet.S67,
      debetFirstSubcontoId: analiticId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
    };
  }
  if (kind === "mediator") {
    return {
      debet: Schet.S65,
      debetFirstSubcontoId: analiticId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
    };
  }
  if (kind === "deliverer") {
    return {
      debet: Schet.S64,
      debetFirstSubcontoId: analiticId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
    };
  }
  return {
    debet: Schet.S66,
    debetFirstSubcontoId: storageId,
    debetSecondSubcontoId: null,
    debetThirdSubcontoId: null,
  };
};

const assertLine = (line: DocTableItems, index: number) => {
  const kind = (line as DocTableItems & { lineKind?: string }).lineKind as AdvanceLineKind;
  const storageId = Number((line as DocTableItems & { lineStorageId?: number }).lineStorageId) || 0;
  const analiticId = Number(line.analiticId) || 0;
  const place = index + 1;
  if (kind === "expense" && (!storageId || !analiticId)) {
    throw new Error(
      `${place}-қатор: харажат учун бўлим ва харажат турини танланг`,
    );
  }
  if (kind === "founder" && !storageId) {
    throw new Error(`${place}-қатор: таъсисчи ҳамёнини танланг`);
  }
  if (kind !== "expense" && kind !== "founder" && !analiticId) {
    throw new Error(`${place}-қатор: аналитикани танланг`);
  }
  if (kind !== "founder" && kind !== "expense" && !storageId) {
    throw new Error(`${place}-қатор: бўлимни танланг`);
  }
};

export const buildAdvanceIssueEntries = (
  doc: Document,
): EntryCreationAttrs[] => {
  const workerId = Number(doc.docValues?.analiticId) || 0;
  const cashId = Number(doc.docValues?.senderId) || 0;
  const total = Number(doc.docValues?.total) || 0;
  const usd = Number(doc.docValues?.usd) || 0;
  if (!cashId || !workerId || total <= 0) {
    throw new Error("Касса, ходим ва суммани тўлдиринг");
  }
  const enterpriseId = Number(doc.enterpriseId) || 0;
  if (!enterpriseId) {
    throw new Error("Ҳужжат корхонаси аниқланмади");
  }
  const description = (doc.docValues?.comment || "").substring(0, 255);
  return [
    {
      date: doc.date,
      documentType: doc.documentType,
      docId: doc.id,
      debet: Schet.S71,
      debetFirstSubcontoId: workerId,
      debetSecondSubcontoId: cashId,
      debetThirdSubcontoId: null,
      kredit: cashSchet(doc.date),
      kreditFirstSubcontoId: cashId,
      kreditSecondSubcontoId: workerId,
      kreditThirdSubcontoId: null,
      count: 0,
      total,
      usd,
      description,
      fullDescription: description,
      enterpriseId,
    },
  ];
};

export const buildAdvanceCloseEntries = async (
  doc: Document,
  referencesService: ReferencesService,
): Promise<EntryCreationAttrs[]> => {
  const workerId = Number(doc.docValues?.analiticId) || 0;
  const cashId = Number(doc.docValues?.senderId) || 0;
  const headerTotal = Number(doc.docValues?.total) || 0;
  const headerUsd = Number(doc.docValues?.usd) || 0;
  const ourEnterpriseId = Number(doc.enterpriseId) || 0;
  if (!cashId || !workerId || headerTotal <= 0 || !ourEnterpriseId) {
    throw new Error("Касса, ходим ва суммани тўлдиринг");
  }

  const lines = filledLines(doc);
  if (!lines.length) {
    throw new Error("Ёпиш учун камида битта қатор қўшинг");
  }
  lines.forEach((line, index) => assertLine(line, index));

  const linesTotal = lines.reduce((sum, line) => sum + Number(line.total || 0), 0);
  if (!moneyEquals(linesTotal, headerTotal)) {
    throw new Error(
      `Қаторлар суммаси (${round2(linesTotal)}) берилган суммага (${round2(headerTotal)}) тенг эмас`,
    );
  }

  const cashRef = await referencesService.getReferenceById(cashId);
  const ourCommon = cashRef?.enterpriseId
    ? await referencesService.findCommonStorageByEnterpriseId(cashRef.enterpriseId)
    : null;
  const ourCommonId = ourCommon?.id ?? cashId;
  const description = (doc.docValues?.comment || "").substring(0, 255);
  const schetCash = cashSchet(doc.date);

  const usdParts: number[] = [];
  let usdUsed = 0;
  lines.forEach((line, index) => {
    if (!headerUsd) {
      usdParts.push(0);
      return;
    }
    if (index === lines.length - 1) {
      usdParts.push(round2(headerUsd - usdUsed));
      return;
    }
    const part = round2(headerUsd * (Number(line.total) / headerTotal));
    usdUsed = round2(usdUsed + part);
    usdParts.push(part);
  });

  const entries: EntryCreationAttrs[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const kind = (line as DocTableItems & { lineKind?: string }).lineKind as AdvanceLineKind;
    const storageId = Number((line as DocTableItems & { lineStorageId?: number }).lineStorageId) || 0;
    const analiticId = Number(line.analiticId) || 0;
    const lineDate = line.settlementDate ? BigInt(line.settlementDate) : doc.date;
    const total = Number(line.total) || 0;
    const usd = usdParts[index] || 0;
    const debit = debitOfLine(
      kind,
      analiticId || null,
      storageId || null,
      cashId,
    );

    const storage = storageId
      ? await referencesService.getReferenceById(storageId)
      : null;
    const storageEnterpriseId = Number(storage?.enterpriseId) || 0;
    const otherOrg =
      storageEnterpriseId > 0 && storageEnterpriseId !== ourEnterpriseId;

    if (!otherOrg) {
      entries.push({
        date: lineDate,
        documentType: doc.documentType,
        docId: doc.id,
        ...debit,
        kredit: Schet.S71,
        kreditFirstSubcontoId: workerId,
        kreditSecondSubcontoId: cashId,
        kreditThirdSubcontoId: null,
        count: 0,
        total,
        usd,
        description,
        fullDescription: description,
        enterpriseId: ourEnterpriseId,
      });
      continue;
    }

    const theirCommon =
      await referencesService.findCommonStorageByEnterpriseId(storageEnterpriseId);
    if (!theirCommon?.id) {
      throw new Error(
        "Бошқа корхона учун COMMON омбор топилмади",
      );
    }

    entries.push({
      date: lineDate,
      documentType: doc.documentType,
      docId: doc.id,
      debet: Schet.S41,
      debetFirstSubcontoId: storageId,
      debetSecondSubcontoId: analiticId || null,
      debetThirdSubcontoId: null,
      kredit: Schet.S71,
      kreditFirstSubcontoId: workerId,
      kreditSecondSubcontoId: cashId,
      kreditThirdSubcontoId: null,
      count: 0,
      total,
      usd,
      description,
      fullDescription: description,
      enterpriseId: ourEnterpriseId,
    });

    entries.push({
      date: lineDate,
      documentType: doc.documentType,
      docId: doc.id,
      debet: schetCash,
      debetFirstSubcontoId: storageId,
      debetSecondSubcontoId: ourCommonId,
      debetThirdSubcontoId: null,
      kredit: Schet.S41,
      kreditFirstSubcontoId: ourCommonId,
      kreditSecondSubcontoId: analiticId || null,
      kreditThirdSubcontoId: null,
      count: 0,
      total,
      usd,
      description,
      fullDescription: description,
      enterpriseId: storageEnterpriseId,
      targetEnterpriseId: storageEnterpriseId,
    });

    entries.push({
      date: lineDate,
      documentType: doc.documentType,
      docId: doc.id,
      ...debit,
      kredit: schetCash,
      kreditFirstSubcontoId: storageId,
      kreditSecondSubcontoId: ourCommonId,
      kreditThirdSubcontoId: null,
      count: 0,
      total,
      usd,
      description,
      fullDescription: description,
      enterpriseId: storageEnterpriseId,
      targetEnterpriseId: storageEnterpriseId,
    });
  }

  return entries;
};
