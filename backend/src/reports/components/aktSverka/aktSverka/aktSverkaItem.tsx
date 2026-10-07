import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { EntriesService } from 'src/entries/entries.service';
import { query } from 'src/reports/querys/query';
import { OborotsService } from 'src/oborots/oborots.service';
import { StocksService } from 'src/stocks/stocks.service';

export const aktSverkaItem = async ( 
  startDate: number | null,
  endDate: number | null,
  currentPartnerId: number | null, 
  title: string, 
  schet: Schet | null,
  entriesService: EntriesService,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {

  const promises = [
    query(schet, TypeQuery.POSUM, startDate, endDate, currentPartnerId, null, null, stocksService, oborotsService, enterpriseId), // POSUM - остаток на начало периода
    query(schet, TypeQuery.KOSUM, startDate, endDate, currentPartnerId, null, null, stocksService, oborotsService, enterpriseId), // KOSUM - остаток на начало периода (передаем startDate как endDate)
    // query(schet, TypeQuery.TDSUM, startDate, endDate, currentPartnerId, null, null, stocksService, oborotsService, enterpriseId), // TDSUM - обороты за период
    // query(schet, TypeQuery.TKSUM, startDate, endDate, currentPartnerId, null, null, stocksService, oborotsService, enterpriseId), // TKSUM - обороты за период
  ];

  const [
    POSUM,
    KOSUM,
    // TDSUM,
    // TKSUM,
  ] = await Promise.all(promises);

  const results = await entriesService.getAllEntriesBySchet({ 
    startDate, 
    endDate, 
    schet: schet, 
    firstSubcontoId: currentPartnerId,
    secondSubcontoId: null,
    thirdSubcontoId: null,
    enterpriseId: enterpriseId,
  });

  // Рассчитываем остатки
  // startBalance = дебетовый остаток на начало - кредитовый остаток на начало
  const startBalance = POSUM || 0
  // const periodDebit = TDSUM || 0;
  // const periodCredit = TKSUM || 0;
  const endBalance = KOSUM || 0;

  return {
    section: title,
    startBalans: startBalance,
    endBalans: endBalance,
    sectionId: currentPartnerId,
    results: results,
    // Детализация для отображения
    // startBalance: POSUM || 0,
    // endBalance: KOSUM || 0,
  };
};
