import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";

export const POUSD = async (
  schet: Schet | null,
  typeQuery: TypeQuery | null,
  startDate: number | null,
  endDate: number | null,
  firstSubcontoId: number | undefined | null,
  secondSubcontoId: number | null,
  thirdSubcontoId: number | null,
  stocksService: StocksService,
  enterpriseId?: number | null,
) => {
  if (schet && startDate && firstSubcontoId) {
    return (
      await stocksService.getStockByDate(
        schet,
        firstSubcontoId,
        secondSubcontoId,
        startDate,
        undefined,
        enterpriseId,
      )
    ).remainUsd;
  } else return 0;
};
