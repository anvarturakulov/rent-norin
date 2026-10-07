import {
  TypePartners,
  TypeReference,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { query } from "src/reports/querys/query";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { DebitorKreditorMode } from "./debitorKreditorMode";

type ClientAggregate = {
  name: string;
  debitStart: number;
  debitEnd: number;
  debitOborot: number;
  kreditOborot: number;
};

export const debitorKreditorToolsAtClient = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
  mode: DebitorKreditorMode = "balances",
) => {
  const innersDebitStart: { id: number; name: string; value: number }[] = [];
  const innersDebitEnd: { id: number; name: string; value: number }[] = [];
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

  const filteredClients = data.filter(
    (item) =>
      item?.typeReference === TypeReference.PARTNERS &&
      !item.refValues?.markToDeleted &&
      item.refValues?.typePartners === TypePartners.CLIENTS &&
      !item.isFolder &&
      (enterpriseId != null
        ? item.enterpriseId === enterpriseId || item.enterpriseId === null
        : true),
  );

  const closingAsOf =
    endDate != null && endDate !== undefined ? endDate + 1 : endDate;

  const clientTasks = filteredClients.map(async (client) => {
    const clientId = client.id;
    const movementIds =
      await oborotsService.getSecondSubcontoIdsWithMovementForSchet(
        Schet.S12,
        clientId,
        startDate,
        endDate,
        enterpriseId,
      );

    const candidateIds = movementIds.filter((id) => id > 0 && toolIds.has(id));

    let debitStart = 0;
    let debitEnd = 0;
    let debitOborot = 0;
    let kreditOborot = 0;

    await Promise.all(
      candidateIds.map(async (toolId) => {
        if (mode === "oborot") {
          const [td, tk] = await Promise.all([
            query(
              Schet.S12,
              TypeQuery.TDSUM,
              startDate,
              endDate,
              clientId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S12,
              TypeQuery.TKSUM,
              startDate,
              endDate,
              clientId,
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
              Schet.S12,
              TypeQuery.POSUM,
              startDate,
              endDate,
              clientId,
              toolId,
              null,
              stocksService,
              oborotsService,
              enterpriseId,
            ),
            query(
              Schet.S12,
              TypeQuery.KOSUM,
              startDate,
              closingAsOf,
              clientId,
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

    return {
      clientId,
      name: client.name,
      debitStart,
      debitEnd,
      debitOborot,
      kreditOborot,
    };
  });

  const clientResults = await Promise.all(clientTasks);
  const aggregated = new Map<number, ClientAggregate>();
  for (const row of clientResults) {
    if (
      row.debitStart <= 0 &&
      row.debitEnd <= 0 &&
      row.debitOborot <= 0 &&
      row.kreditOborot <= 0
    ) {
      continue;
    }
    aggregated.set(row.clientId, row);
  }

  for (const [clientId, agg] of aggregated.entries()) {
    const { name, debitStart, debitEnd, debitOborot, kreditOborot } = agg;
    if (mode !== "oborot") {
      if (debitStart > 0) {
        innersDebitStart.push({ id: clientId, name, value: debitStart });
      }
      if (debitEnd > 0) {
        innersDebitEnd.push({ id: clientId, name, value: debitEnd });
      }
    }
    if (mode !== "balances") {
      if (debitOborot > 0) {
        innersDebitOborot.push({ id: clientId, name, value: debitOborot });
      }
      if (kreditOborot > 0) {
        innersKreditOborot.push({ id: clientId, name, value: kreditOborot });
      }
    }
  }

  if (mode === "oborot") {
    return {
      innerReportType: "TOOLS_AT_CLIENT",
      schet: Schet.S12,
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
    innerReportType: "TOOLS_AT_CLIENT",
    schet: Schet.S12,
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
