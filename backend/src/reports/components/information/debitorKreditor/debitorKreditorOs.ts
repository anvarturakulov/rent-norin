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

type OsAggregate = {
  name: string;
  s01Start: number;
  s01End: number;
  s02Start: number;
  s02End: number;
  debitOborot: number;
  kreditOborot: number;
};

export const debitorKreditorOs = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
  mode: DebitorKreditorMode = "balances",
) => {
  const innersDebitStart: { name: string; value: number }[] = [];
  const innersKreditStart: { name: string; value: number }[] = [];
  const innersDebitEnd: { name: string; value: number }[] = [];
  const innersKreditEnd: { name: string; value: number }[] = [];
  const innersDebitOborot: { id: number; name: string; value: number }[] = [];
  const innersKreditOborot: { id: number; name: string; value: number }[] = [];

  const idToRef = new Map<number, Reference>();
  for (const item of data) {
    if (
      item?.id != null &&
      item.typeReference === TypeReference.TMZ &&
      item.refValues?.typeTMZ === TypeTMZ.OS
    ) {
      idToRef.set(item.id, item);
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

  const aggregated = new Map<number, OsAggregate>();
  const closingAsOf =
    endDate != null && endDate !== undefined ? endDate + 1 : endDate;

  const pairTasks = filteredStorages.flatMap((storage) => async () => {
    const storageId = storage.id;
    const [movementIds, stockIds] = await Promise.all([
      oborotsService.getOsIdsWithMovementAtStorage(
        storageId,
        startDate,
        endDate,
        enterpriseId,
      ),
      stocksService.getOsIdsWithStockAtStorage(storageId, enterpriseId),
    ]);

    const candidateIds = new Set<number>();
    for (const id of [...movementIds, ...stockIds]) {
      if (id > 0) candidateIds.add(id);
    }

    return Promise.all(
      [...candidateIds].map(async (osId) => {
        let s01Start = 0;
        let s01End = 0;
        let s02Start = 0;
        let s02End = 0;
        let tdSum = 0;
        let tkSum = 0;

        if (mode === "oborot") {
          [tdSum, tkSum] = await Promise.all([
            query(
              Schet.S01,
              TypeQuery.TDSUM,
              startDate,
              endDate,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S01,
              TypeQuery.TKSUM,
              startDate,
              endDate,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
          ]);
        } else {
          [s01Start, s01End, s02Start, s02End] = await Promise.all([
            query(
              Schet.S01,
              TypeQuery.POSUM,
              startDate,
              endDate,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S01,
              TypeQuery.KOSUM,
              startDate,
              closingAsOf,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S02,
              TypeQuery.POSUM,
              startDate,
              endDate,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S02,
              TypeQuery.KOSUM,
              startDate,
              closingAsOf,
              storageId,
              osId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
          ]);
        }

        return { osId, s01Start, s01End, s02Start, s02End, tdSum, tkSum };
      }),
    );
  });

  const storageResults = await Promise.all(pairTasks.map((task) => task()));

  for (const pairs of storageResults) {
    for (const { osId, s01Start, s01End, s02Start, s02End, tdSum, tkSum } of pairs) {
      const ref = idToRef.get(osId);
      const name = ref?.name ?? `ОС #${osId}`;
      const existing = aggregated.get(osId);
      if (existing) {
        existing.s01Start += s01Start;
        existing.s01End += s01End;
        existing.s02Start += s02Start;
        existing.s02End += s02End;
        existing.debitOborot += tdSum;
        existing.kreditOborot += tkSum;
      } else {
        aggregated.set(osId, {
          name,
          s01Start,
          s01End,
          s02Start,
          s02End,
          debitOborot: tdSum,
          kreditOborot: tkSum,
        });
      }
    }
  }

  for (const [osId, agg] of aggregated.entries()) {
    const { name, s01Start, s01End, s02Start, s02End, debitOborot, kreditOborot } =
      agg;
    if (mode !== "oborot") {
      if (s01Start > 0) innersDebitStart.push({ name, value: s01Start });
      if (s01End > 0) innersDebitEnd.push({ name, value: s01End });
      if (s02Start > 0) innersKreditStart.push({ name, value: s02Start });
      if (s02End > 0) innersKreditEnd.push({ name, value: s02End });
    }
    if (mode !== "balances") {
      if (debitOborot > 0) {
        innersDebitOborot.push({ id: osId, name, value: debitOborot });
      }
      if (kreditOborot > 0) {
        innersKreditOborot.push({ id: osId, name, value: kreditOborot });
      }
    }
  }

  if (mode === "oborot") {
    return {
      innerReportType: "OS",
      schet: Schet.S01,
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
    innerReportType: "OS",
    schet: Schet.S01,
    totalDebitStart: innersDebitStart.reduce((acc, item) => acc + item.value, 0),
    totalKreditStart: innersKreditStart.reduce(
      (acc, item) => acc + item.value,
      0,
    ),
    innersDebitStart: [...innersDebitStart],
    innersKreditStart: [...innersKreditStart],
    totalDebitEnd: innersDebitEnd.reduce((acc, item) => acc + item.value, 0),
    totalKreditEnd: innersKreditEnd.reduce((acc, item) => acc + item.value, 0),
    innersDebitEnd: [...innersDebitEnd],
    innersKreditEnd: [...innersKreditEnd],
    totalDebitOborot: innersDebitOborot.reduce((acc, item) => acc + item.value, 0),
    totalKreditOborot: innersKreditOborot.reduce(
      (acc, item) => acc + item.value,
      0,
    ),
    innersDebitOborot: [...innersDebitOborot],
    innersKreditOborot: [...innersKreditOborot],
  };
};
