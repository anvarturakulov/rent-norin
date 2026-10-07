import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { StocksService } from "src/stocks/stocks.service";

export const POSUM = async (
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
    const stockData = await stocksService.getStockByDate(
      schet,
      firstSubcontoId,
      secondSubcontoId,
      startDate,
      undefined,
      enterpriseId,
    );
    const remainTotal = stockData.remainTotal;

    // Логирование для диагностики завышенной себестоимости
    // if (secondSubcontoId) {
    //     console.log(`💰 [POSUM] Остаток суммы для материала ID ${secondSubcontoId}:`, {
    //         schet,
    //         firstSubcontoId,
    //         secondSubcontoId,
    //         startDate: startDate ? new Date(startDate).toISOString() : null,
    //         enterpriseId,
    //         remainTotal,
    //         remainCount: stockData.remainCount,
    //         date: stockData.date ? new Date(Number(stockData.date)).toISOString() : null
    //     });
    // }

    return remainTotal;
  } else return 0;
};
