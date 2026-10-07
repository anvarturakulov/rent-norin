import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";

export const KOUSD = async (
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
  if (schet && endDate && firstSubcontoId) {
    return (
      await stocksService.getStockByDate(
        schet,
        firstSubcontoId,
        secondSubcontoId,
        endDate,
        undefined,
        enterpriseId,
      )
    ).remainUsd;
  } else return 0;
};
