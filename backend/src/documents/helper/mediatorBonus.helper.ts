import { Document } from "src/documents/document.model";
import { RefValues } from "src/refvalues/refValues.model";
import { Schet } from "src/interfaces/report.interface";
import { ReferencesService } from "src/references/references.service";
import { SettingsService } from "src/settings/settings.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

const MEDIATOR_BONUS_DESCRIPTION = "бонус хисобланди";

export const parseNumberOrFallback = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Чистый доход аренды: Σ max(0, rentSum − price) по строкам возврата */
export const sumReceiveRentNetIncome = (doc: Document): number =>
  (doc.docTableItems ?? [])
    .filter((row) => (row.tableType || "return") === "return")
    .reduce((sum, row) => {
      const rentSum = parseNumberOrFallback(row.rentSum, 0);
      const price = parseNumberOrFallback(row.price, 0);
      return sum + Math.max(0, rentSum - price);
    }, 0);

/** Скидка (price) по строке возврата не может быть отрицательной или выше ижары (rentSum). */
export const getReceiveToolsDiscountError = (
  items:
    | Array<{ tableType?: string | null; rentSum?: number | null; price?: number | null }>
    | null
    | undefined,
): string | null => {
  for (const row of items ?? []) {
    if ((row.tableType || "return") !== "return") continue;
    const rentSum = parseNumberOrFallback(row.rentSum, 0);
    const price = parseNumberOrFallback(row.price, 0);
    if (price < -0.0001 || price - rentSum > 0.0001) {
      return "Скидка ижара суммасидан ошмаслиги керак";
    }
  }
  return null;
};

/** Цена продажи клиенту не может быть ниже себестоимости. */
export const getReceiveToolsSalePriceError = (
  items:
    | Array<{
        tableType?: string | null;
        price?: number | null;
        costPrice?: number | null;
      }>
    | null
    | undefined,
): string | null => {
  for (const row of items ?? []) {
    if (row.tableType !== "sale") continue;
    const price = parseNumberOrFallback(row.price, 0);
    const costPrice = parseNumberOrFallback(row.costPrice, 0);
    if (price < costPrice - 0.0001) {
      return "Мижозга сотиш: нарх себестоимостьдан паст бўлмаслиги керак";
    }
  }
  return null;
};

export function partnerHasMediatorRole(refValues?: RefValues | null): boolean {
  return Boolean(refValues?.isMediatorDriver || refValues?.isMediatorMaster);
}

export async function resolvePartnerMediatorPercent(
  settingsService: SettingsService,
  date: number,
  enterpriseId: number | null | undefined,
  refValues?: RefValues | null,
): Promise<number> {
  const entId = enterpriseId ?? undefined;
  if (refValues?.isMediatorDriver) {
    const driverPercent = await settingsService.getPereodicValueForDateByKey(
      "toolsRent.mediatorBonusPercent.driver",
      date,
      entId,
    );
    if (driverPercent > 0) return driverPercent;
  }
  if (refValues?.isMediatorMaster) {
    const masterPercent = await settingsService.getPereodicValueForDateByKey(
      "toolsRent.mediatorBonusPercent.master",
      date,
      entId,
    );
    if (masterPercent > 0) return masterPercent;
  }
  return settingsService.getPereodicValueForDateByKey(
    "toolsRent.mediatorBonusPercent",
    date,
    entId,
  );
}

export async function computeReceiveMediatorBonus(
  doc: Document,
  settingsService: SettingsService,
  referencesService: ReferencesService,
): Promise<{ bonus: number; incomeBase: number; partnerId: number } | null> {
  const partnerId = doc.docValues?.senderId;
  if (!partnerId) return null;

  const partner = await referencesService.getReferenceById(partnerId);
  if (!partnerHasMediatorRole(partner?.refValues)) return null;

  const incomeBase = sumReceiveRentNetIncome(doc);
  if (incomeBase <= 0) return null;

  const percent = await resolvePartnerMediatorPercent(
    settingsService,
    Number(doc.date),
    doc.enterpriseId,
    partner?.refValues,
  );
  if (percent <= 0) return null;

  const bonus = round2((incomeBase * percent) / 100);
  if (bonus <= 0) return null;

  const minSetting = await settingsService.getSettingByKey(
    "toolsRent.mediatorBonusMinAmount",
    doc.enterpriseId ?? undefined,
  );
  const minAmount = minSetting ? Number(minSetting.value) || 0 : 0;
  if (minAmount > 0 && bonus < minAmount) return null;

  return { bonus, incomeBase, partnerId };
}

export async function getMediatorExpenseSubcontoIds(
  settingsService: SettingsService,
  enterpriseId?: number | null,
): Promise<{ expenseSectionId: number | null; chargeId: number | null }> {
  const sectionSetting = await settingsService.getSettingByKey(
    "toolsRent.mediatorExpenseSectionId",
    enterpriseId ?? undefined,
  );
  const chargeSetting = await settingsService.getSettingByKey(
    "toolsRent.mediatorChargeId",
    enterpriseId ?? undefined,
  );
  const expenseSectionId = sectionSetting
    ? Number(sectionSetting.value) || null
    : null;
  const chargeId = chargeSetting ? Number(chargeSetting.value) || null : null;
  return { expenseSectionId, chargeId };
}

export interface MediatorBonusEntryValues {
  debet: Schet;
  kredit: Schet;
  debetFirstSubcontoId: number | null;
  debetSecondSubcontoId: number | null;
  debetThirdSubcontoId: number | null;
  kreditFirstSubcontoId: number | null;
  kreditSecondSubcontoId: number | null;
  kreditThirdSubcontoId: number | null;
  count: number;
  total: number;
  usd: number;
  description: string;
  fullDescription: string;
}

export async function buildReceiveMediatorBonusEntry(
  doc: Document,
  settingsService: SettingsService,
  referencesService: ReferencesService,
): Promise<MediatorBonusEntryValues | null> {
  const result = await computeReceiveMediatorBonus(
    doc,
    settingsService,
    referencesService,
  );
  if (!result) return null;

  const { expenseSectionId, chargeId } = await getMediatorExpenseSubcontoIds(
    settingsService,
    doc.enterpriseId,
  );
  if (!expenseSectionId || !chargeId) return null;

  return {
    debet: Schet.S20,
    kredit: Schet.S65,
    debetFirstSubcontoId: expenseSectionId,
    debetSecondSubcontoId: chargeId,
    debetThirdSubcontoId: null,
    kreditFirstSubcontoId: result.partnerId,
    kreditSecondSubcontoId: null,
    kreditThirdSubcontoId: null,
    count: 0,
    total: result.bonus,
    usd: doc.docValues?.usd ?? 0,
    description: MEDIATOR_BONUS_DESCRIPTION,
    fullDescription: MEDIATOR_BONUS_DESCRIPTION,
  };
}
