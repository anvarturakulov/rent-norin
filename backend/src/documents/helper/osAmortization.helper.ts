import { Schet } from "src/interfaces/report.interface";
import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { ReferencesService } from "src/references/references.service";
import { SettingsService } from "src/settings/settings.service";
import { StocksService } from "src/stocks/stocks.service";

export interface OsAmortizationPreviewLine {
  analiticId: number;
  balance: number;
  costPrice: number;
  price: number;
  total: number;
  count: number;
}

export async function resolveOsAmortizationChargeId(
  settingsService: SettingsService,
  enterpriseId: number,
): Promise<number> {
  const raw = await settingsService.getSetting(
    "osAmortizationChargeId",
    enterpriseId,
  );
  const id = raw != null ? Number(raw) : 0;
  if (!id) {
    throw new Error(
      "Не задана настройка osAmortizationChargeId (статья затрат для амортизации ОС)",
    );
  }
  return id;
}

export async function resolveOsAmortizationCommonStorageId(
  senderId: number,
  enterpriseId: number,
  referencesService: ReferencesService,
  settingsService: SettingsService,
): Promise<number> {
  const fromSetting = await settingsService.getSetting(
    "osAmortizationCommonStorageId",
    enterpriseId,
  );
  if (fromSetting != null) {
    return Number(fromSetting);
  }

  const common =
    await referencesService.findCommonStorageByEnterpriseId(enterpriseId);
  if (common?.id) {
    return common.id;
  }

  return senderId;
}

export function getMonthBoundsFromDocDate(docDateMs: number): {
  monthStart: number;
  monthEnd: number;
} {
  const d = new Date(docDateMs);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const monthEnd = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  ).getTime();
  return { monthStart, monthEnd };
}

export async function getStockSumAtDate(
  stocksService: StocksService,
  schet: Schet,
  storageId: number,
  osId: number,
  dateMs: number,
  enterpriseId?: number | null,
): Promise<number> {
  if (enterpriseId == null) {
    return 0;
  }
  const stock = await stocksService.getStockByDate(
    schet,
    storageId,
    osId,
    dateMs,
    undefined,
    enterpriseId,
  );
  return Number(stock?.remainTotal ?? 0);
}

export async function buildOsAmortizationPreviewLines(
  storageId: number,
  docDateMs: number,
  enterpriseId: number,
  referencesService: ReferencesService,
  stocksService: StocksService,
): Promise<OsAmortizationPreviewLine[]> {
  const { monthStart } = getMonthBoundsFromDocDate(docDateMs);
  const allRefs = await referencesService.getReferencesForReport(enterpriseId);
  const osItems = (allRefs as Reference[]).filter(
    (r) =>
      r.typeReference === TypeReference.TMZ &&
      r.refValues?.typeTMZ === TypeTMZ.OS &&
      !r.isFolder &&
      !r.refValues?.markToDeleted,
  );

  const lines: OsAmortizationPreviewLine[] = [];

  for (const os of osItems) {
    const coef = Number(os.refValues?.amortizationCoefficient ?? 0);
    if (coef <= 0) continue;

    const startDateRaw = os.refValues?.amortizationStartDate;
    if (startDateRaw) {
      const startMs = new Date(startDateRaw).getTime();
      if (startMs > docDateMs) continue;
    }

    const grossStart = await getStockSumAtDate(
      stocksService,
      Schet.S01,
      storageId,
      os.id,
      monthStart,
      enterpriseId,
    );
    if (grossStart <= 0) continue;

    const accumStart = await getStockSumAtDate(
      stocksService,
      Schet.S02,
      storageId,
      os.id,
      monthStart,
      enterpriseId,
    );

    const residualStart = Math.max(0, grossStart - accumStart);
    if (residualStart <= 0) continue;

    const monthly = Math.round((grossStart * coef) / 100 / 12);
    const total = Math.min(monthly, residualStart);
    if (total <= 0) continue;

    lines.push({
      analiticId: os.id,
      balance: grossStart,
      costPrice: accumStart,
      price: coef,
      total,
      count: 1,
    });
  }

  return lines;
}

export async function getOsAccumulatedDepreciationAtDate(
  stocksService: StocksService,
  storageId: number,
  osId: number,
  dateMs: number,
  enterpriseId?: number | null,
): Promise<number> {
  return getStockSumAtDate(
    stocksService,
    Schet.S02,
    storageId,
    osId,
    dateMs,
    enterpriseId,
  );
}
