import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { query } from 'src/reports/querys/query';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';

const getName = (data: any, id: number | null, schet: Schet | null): string => {
  if (id == null) return 'ТАНЛАНМАГАН КАТОР';
  if (data && data.length) {
    // Для счета S41 (departments) ищем в STORAGES
    if (schet === Schet.S41) {
      // Сначала ищем в STORAGES с typeSection = COMMON
      const storageItemCommon = data.find((item: Reference) => 
        item.id == id && 
        item.typeReference === TypeReference.STORAGES &&
        item.refValues?.typeSection === TypeSECTION.COMMON
      );
      if (storageItemCommon) return storageItemCommon.name;
      
      // Если не нашли COMMON, ищем любой STORAGES с таким id
      const storageItem = data.find((item: Reference) => 
        item.id == id && 
        item.typeReference === TypeReference.STORAGES
      );
      if (storageItem) return storageItem.name;
      
      // Если не нашли в STORAGES, пробуем найти в PARTNERS (для обратной совместимости)
      const partnerItem = data.find((item: Reference) => 
        item.id == id && 
        item.typeReference === TypeReference.PARTNERS
      );
      if (partnerItem) return partnerItem.name;
      
      // Если ничего не нашли, пробуем найти по id без проверки типа (на случай проблем с данными)
      const anyItem = data.find((item: Reference) => item.id == id);
      if (anyItem) return anyItem.name;
    } else {
      // Для других счетов (S40, S60) ищем в PARTNERS
      const item = data.find((item: Reference) => item.id == id);
      if (item) return item.name;
    }
  }
  return 'ТАНЛАНМАГАН КАТОР';
};

export const oborotkaItem = async ( 
  data: any,
  startDate: number | null,
  endDate: number | null,
  firstSubcontoId: number | null,
  secondList: any,
  schet: Schet | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {    
  const topPromisesRemains = [
    query(schet, TypeQuery.POSUM, startDate, endDate, firstSubcontoId, null, null, stocksService, oborotsService, enterpriseId),
    query(schet, TypeQuery.KOSUM, startDate, endDate, firstSubcontoId, null, null, stocksService, oborotsService, enterpriseId),
    query(schet, TypeQuery.TDSUM, startDate, endDate, firstSubcontoId, null, null, stocksService, oborotsService, enterpriseId),
    query(schet, TypeQuery.TKSUM, startDate, endDate, firstSubcontoId, null, null, stocksService, oborotsService, enterpriseId),
    
  ];

  const [POSUM, KOSUM, TDSUM, TKSUM] = await Promise.all(topPromisesRemains);
  
  
  let subResults: any[] = [];
  
  if (secondList && secondList.length) {
    for (const secondSubcontoId of secondList) {
      const subPromises = [
        query(schet, TypeQuery.POSUM, startDate, endDate, firstSubcontoId, secondSubcontoId, null, stocksService, oborotsService, enterpriseId),
        query(schet, TypeQuery.KOSUM, startDate, endDate, firstSubcontoId, secondSubcontoId, null, stocksService, oborotsService, enterpriseId),
        query(schet, TypeQuery.TDSUM, startDate, endDate, firstSubcontoId, secondSubcontoId, null, stocksService, oborotsService, enterpriseId),
        query(schet, TypeQuery.TKSUM, startDate, endDate, firstSubcontoId, secondSubcontoId, null, stocksService, oborotsService, enterpriseId),
      ];
      
      const [subPOSUM, subKOSUM, subTDSUM, subTKSUM] = await Promise.all(subPromises);
      
      if (subTDSUM || subTKSUM || subKOSUM || subPOSUM) {
        let subElement = {
          name: getName(data, secondSubcontoId, schet),
          sectionId: secondSubcontoId,
          subPOSUM,
          subKOSUM,
          subTDSUM,
          subTKSUM,
        };
        subResults.push(subElement);
      }
    }
  }
  
  

  if (!POSUM && !POSUM && !TDSUM && !TKSUM && subResults.length == 0) return {};

  let element = {
    name: getName(data, firstSubcontoId, schet),
    sectionId: firstSubcontoId,
    POSUM,
    TDSUM,
    TKSUM,
    KOSUM,
    subItems: [...subResults]
  };
  return element;
};