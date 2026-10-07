import { mediatorPersonal } from "./mediatorPersonal/mediatorPersonal";
import { Entry } from "src/entries/entry.model";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";

export const mediatorPersonalAll = async (
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  mediatorId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const personalResult = await mediatorPersonal(
    data,
    entries,
    startDate,
    endDate,
    mediatorId,
    stocksService,
    oborotsService,
    enterpriseId,
  );
  return { ...personalResult };
};
