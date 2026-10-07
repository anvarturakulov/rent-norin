import { TypeReference } from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { query } from "src/reports/querys/query";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";

const hasAnyMovement = (...values: number[]) =>
  values.some((v) => v !== 0 && v !== null && !Number.isNaN(v));

const prepareOsResult = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const result: any[] = [];
  const storageId = currentSectionId;
  if (!storageId) return result;

  const idToRef = new Map<number, Reference>();
  const idToRefName = new Map<number, string>();
  for (const item of data) {
    if (item?.id != null && item.typeReference === TypeReference.TMZ) {
      idToRef.set(item.id, item);
      idToRefName.set(item.id, (item.name ?? "").trim());
    }
  }

  const movementIds = await oborotsService.getOsIdsWithMovementAtStorage(
    storageId,
    startDate,
    endDate,
    enterpriseId,
  );
  const stockIds = await stocksService.getOsIdsWithStockAtStorage(
    storageId,
    enterpriseId,
  );

  const candidateIds = new Set<number>();
  for (const id of [...movementIds, ...stockIds]) {
    if (id > 0) candidateIds.add(id);
  }

  for (const osId of candidateIds) {
    const item = idToRef.get(osId);

    const [
      pos01,
      pos02,
      tds01,
      tks01,
      tks02,
      tds02,
      kos01,
      kos02,
    ] = await Promise.all([
      query(Schet.S01, TypeQuery.POSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S02, TypeQuery.POSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S01, TypeQuery.TDSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S01, TypeQuery.TKSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S02, TypeQuery.TKSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S02, TypeQuery.TDSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S01, TypeQuery.KOSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S02, TypeQuery.KOSUM, startDate, endDate, storageId, osId, null, stocksService, oborotsService, enterpriseId),
    ]);

    if (hasAnyMovement(pos01, pos02, tds01, tks01, tks02, tds02, kos01, kos02)) {
      const pid = (item as any)?.parentId ?? null;
      const parentName =
        pid != null && typeof pid === "number"
          ? idToRefName.get(pid) ?? ""
          : "";
      result.push({
        id: osId,
        parentId: pid,
        parentName: parentName || null,
        isFolder: (item as any)?.isFolder ?? false,
        name: item?.name ?? `ОС #${osId}`,
        article: item?.article ?? "",
        unit: item?.refValues?.unit || "",
        POS01: pos01,
        POS02: pos02,
        residualStart: pos01 - pos02,
        TDS01: tds01,
        TKS01: tks01,
        TKS02: tks02,
        TDS02: tds02,
        KOS01: kos01,
        KOS02: kos02,
        residualEnd: kos01 - kos02,
      });
    }
  }

  return result;
};

export const osOborotSkladItem = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number | null,
  title: string,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const items = await prepareOsResult(
    data,
    startDate,
    endDate,
    currentSectionId,
    stocksService,
    oborotsService,
    enterpriseId,
  );

  return {
    section: title,
    sectionId: currentSectionId,
    accountType: "OS",
    items,
  };
};
