import { QuerySimple, Schet, TypeQuery } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";

export const POKOL = async (
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
  if (schet && startDate && firstSubcontoId) {
    const stockData = await stocksService.getStockByDate(
      schet,
      firstSubcontoId,
      secondSubcontoId,
      startDate,
      undefined,
      enterpriseId,
    );
    const remainCount = stockData.remainCount;

    // // Логирование для диагностики завышенной себестоимости
    // if (secondSubcontoId) {
    //     console.log(`📦 [POKOL] Остаток количества для материала ID ${secondSubcontoId}:`, {
    //         schet,
    //         firstSubcontoId,
    //         secondSubcontoId,
    //         startDate: startDate ? new Date(startDate).toISOString() : null,
    //         enterpriseId,
    //         remainCount,
    //         remainTotal: stockData.remainTotal,
    //         date: stockData.date ? new Date(Number(stockData.date)).toISOString() : null
    //     });
    // }

    return remainCount;
  } else return 0;
};
