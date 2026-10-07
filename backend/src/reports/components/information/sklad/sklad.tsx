import { TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { skladItem } from './skladItem';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const sklad = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {
  

  let result: any[] = [];
  let filteredData: Reference[] = [];

  if (!data || !data.length) {
    return {
      reportType: 'SKLAD',
      values: [],
    };
  }

  filteredData = data.filter((item: Reference) => {
    return (
      item &&
      item.typeReference === TypeReference.STORAGES &&
      item.refValues &&
      !item.refValues.markToDeleted &&
      (item.refValues.typeSection === TypeSECTION.COMMON)
    );
  })
  // Фильтрация по enterpriseId для отчетов одного предприятия
  .filter((item: Reference) => {
    if (enterpriseId !== null && enterpriseId !== undefined) {
      return item.enterpriseId === enterpriseId || item.enterpriseId === null;
    }
    // Для глобальных отчетов показываем все storages
    return true;
  });


  for (const item of filteredData) {
    let element = await skladItem(data, startDate, endDate, item.id, item.name, stocksService, oborotsService, enterpriseId);
    if (Object.keys(element).length) {
      result.push(element);
    }
  }

  return {
    reportType: 'SKLAD',
    values: [...result],
  };
};