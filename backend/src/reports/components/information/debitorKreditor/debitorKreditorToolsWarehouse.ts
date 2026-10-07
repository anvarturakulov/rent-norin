import {
  TypeReference,
  TypeSECTION,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { query } from "src/reports/querys/query";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { DebitorKreditorMode } from "./debitorKreditorMode";

type WarehouseAggregate = {
  name: string;
  debitStart: number;
  debitEnd: number;
  debitOborot: number;
  kreditOborot: number;
};

export const debitorKreditorToolsWarehouse = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
  mode: DebitorKreditorMode = "balances",
) => {
  const innersDebitStart: { name: string; value: number }[] = [];
  const innersDebitEnd: { name: string; value: number }[] = [];
  const innersDebitOborot: { id: number; name: string; value: number }[] = [];
  const innersKreditOborot: { id: number; name: string; value: number }[] = [];

  const toolIds = new Set<number>();
  for (const item of data) {
    if (
      item?.id != null &&
      item.typeReference === TypeReference.TMZ &&
      item.refValues?.typeTMZ === TypeTMZ.TOOLS
    ) {
      toolIds.add(item.id);
    }
  }

  const filteredStorages = data.filter(
    (item) =>
      item?.typeReference === TypeReference.STORAGES &&
      !item.refValues?.markToDeleted &&
      (item.refValues?.typeSection === TypeSECTION.STORAGE ||
        item.refValues?.typeSection === TypeSECTION.COMMON ||
        item.refValues?.typeSection === TypeSECTION.PRODUCTION) &&
      (enterpriseId != null
        ? item.enterpriseId === enterpriseId || item.enterpriseId === null
        : true),
  );

  const aggregated = new Map<number, WarehouseAggregate>();
  const closingAsOf =
    endDate != null && endDate !== undefined ? endDate + 1 : endDate;

  const storageTasks = filteredStorages.map(async (storage) => {
    const storageId = storage.id;
    const [movementIds, stockIds] = await Promise.all([
      oborotsService.getSecondSubcontoIdsWithMovementForSchet(
        Schet.S11,
        storageId,
        startDate,
        endDate,
        enterpriseId,
      ),
      stocksService.getSecondSubcontoIdsWithStockForSchet(
        Schet.S11,
        storageId,
        enterpriseId,
      ),
    ]);

    const candidateIds = new Set<number>();
    for (const id of [...movementIds, ...stockIds]) {
      if (id > 0 && toolIds.has(id)) candidateIds.add(id);
    }

    let debitStart = 0;
    let debitEnd = 0;
    let debitOborot = 0;
    let kreditOborot = 0;

    await Promise.all(
      [...candidateIds].map(async (toolId) => {
        if (mode === "oborot") {
          const [td, tk] = await Promise.all([
            query(
              Schet.S11,
              TypeQuery.TDSUM,
              startDate,
              endDate,
              storageId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S11,
              TypeQuery.TKSUM,
              startDate,
              endDate,
              storageId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
          ]);
          debitOborot += td;
          kreditOborot += tk;
        } else {
          const [startVal, endVal] = await Promise.all([
            query(
              Schet.S11,
              TypeQuery.POSUM,
              startDate,
              endDate,
              storageId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S11,
              TypeQuery.KOSUM,
              startDate,
              closingAsOf,
              storageId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
          ]);
          debitStart += startVal;
          debitEnd += endVal;
        }
      }),
    );

    return { storageId, name: storage.name, debitStart, debitEnd, debitOborot, kreditOborot };
  });

  const storageResults = await Promise.all(storageTasks);
  for (const row of storageResults) {
    if (
      row.debitStart <= 0 &&
      row.debitEnd <= 0 &&
      row.debitOborot <= 0 &&
      row.kreditOborot <= 0
    ) {
      continue;
    }
    aggregated.set(row.storageId, row);
  }

  for (const [storageId, agg] of aggregated.entries()) {
    const { name, debitStart, debitEnd, debitOborot, kreditOborot } = agg;
    if (mode !== "oborot") {
      if (debitStart > 0) innersDebitStart.push({ name, value: debitStart });
      if (debitEnd > 0) innersDebitEnd.push({ name, value: debitEnd });
    }
    if (mode !== "balances") {
      if (debitOborot > 0) {
        innersDebitOborot.push({ id: storageId, name, value: debitOborot });
      }
      if (kreditOborot > 0) {
        innersKreditOborot.push({ id: storageId, name, value: kreditOborot });
      }
    }
  }

  if (mode === "oborot") {
    return {
      innerReportType: "TOOLS_WAREHOUSE",
      schet: Schet.S11,
      totalDebitOborot: innersDebitOborot.reduce((acc, item) => acc + item.value, 0),
      totalKreditOborot: innersKreditOborot.reduce(
        (acc, item) => acc + item.value,
        0,
      ),
      innersDebitOborot: [...innersDebitOborot],
      innersKreditOborot: [...innersKreditOborot],
    };
  }

  return {
    innerReportType: "TOOLS_WAREHOUSE",
    schet: Schet.S11,
    totalDebitStart: innersDebitStart.reduce((acc, item) => acc + item.value, 0),
    totalKreditStart: 0,
    innersDebitStart: [...innersDebitStart],
    innersKreditStart: [],
    totalDebitEnd: innersDebitEnd.reduce((acc, item) => acc + item.value, 0),
    totalKreditEnd: 0,
    innersDebitEnd: [...innersDebitEnd],
    innersKreditEnd: [],
    totalDebitOborot: innersDebitOborot.reduce((acc, item) => acc + item.value, 0),
    totalKreditOborot: innersKreditOborot.reduce(
      (acc, item) => acc + item.value,
      0,
    ),
    innersDebitOborot: [...innersDebitOborot],
    innersKreditOborot: [...innersKreditOborot],
  };
};
