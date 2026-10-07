import { QuerySimple, Schet, TypeQuery } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";

export const KOKOL = async (
  schet: Schet | null,
  typeQuery: TypeQuery | null,
  startDate: number | null,
  endDate: number | null,
  firstSubcontoId: number | null,
  secondSubcontoId: number | null,
  thirdSubcontoId: number | undefined | null,
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
    ).remainCount;
  } else return 0;
};
