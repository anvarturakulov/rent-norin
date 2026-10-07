import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { EntriesService } from 'src/entries/entries.service';
import { query } from 'src/reports/querys/query';
import { OborotsService } from 'src/oborots/oborots.service';
import { StocksService } from 'src/stocks/stocks.service';
import { ReferencesService } from 'src/references/references.service';

export const cashOperationsItem = async ( 
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number | null, 
  title: string, 
  entriesService: EntriesService,
  stocksService: StocksService,
  oborotsService: OborotsService,
  referencesService: ReferencesService,
  enterpriseId?: number | null
) => {

  // Новая логика: получить справочник и проверить isForeign
  let isUsdStorage = false;
  if (currentSectionId !== null) {
    try {
      const reference = await referencesService.getReferenceById(currentSectionId);
      if (reference?.refValues?.isForeign === true) {
        isUsdStorage = true;
      }
    } catch (error) {
      // Если справочник не найден, оставляем isUsdStorage = false
      console.error(`Ошибка при получении справочника ${currentSectionId}:`, error);
    }
  }
  const promises = [
    query(Schet.S50, !isUsdStorage ? TypeQuery.POSUM : TypeQuery.POUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // POSUM
    query(Schet.S50, !isUsdStorage ? TypeQuery.KOSUM : TypeQuery.KOUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // KOSUM
  ];

  const [
    POSUM,
    KOSUM,
  ] = await Promise.all(promises);

  const results = await entriesService.getAllEntriesBySchet({ 
    startDate, 
    endDate, 
    schet: Schet.S50, 
    firstSubcontoId: currentSectionId,
    secondSubcontoId: null,
    thirdSubcontoId: null,
    enterpriseId: enterpriseId,
    includeDocumentUser: true,
  });

  return {
    section: title,
    startBalans: POSUM,
    endBalans: KOSUM,
    sectionId: currentSectionId,
    results: results
  };
};