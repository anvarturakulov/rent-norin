import { TypeReference } from 'src/interfaces/reference.interface';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { OborotsService } from 'src/oborots/oborots.service';
import { Reference } from 'src/references/reference.model';
import { query } from 'src/reports/querys/query';
import { StocksService } from 'src/stocks/stocks.service';

export const skladItem = async ( 
  data: any,
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number, 
  title: string, 
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {    
    let materialsResult: any[] = []; // Результат для материалов (счет S10)
    let productsResult: any[] = [];  // Результат для готовой продукции (счет S28)
    let filteredData: Reference[] = [];

    if (data && data.length) {
      filteredData = data.filter((item: Reference) => item?.typeReference == TypeReference.TMZ);
    }

    for (const item of filteredData) { 
      const promises = [
        query(Schet.S10, TypeQuery.KOKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
        query(Schet.S28, TypeQuery.KOKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
        query(Schet.S10, TypeQuery.KOSUM, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
        query(Schet.S28, TypeQuery.KOSUM, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      ];

      const [kokolS10, kokolS28, kosumS10, kosumS28] = await Promise.all(promises);
      
      // Обработка материалов (счет S10)
      if (kokolS10 != 0) {
        let priceS10 = kokolS10 ? kosumS10 / kokolS10 : 0;
        let materialElement = {
          name: item.name,
          value: kokolS10,
          valueSum: kosumS10,
          price: priceS10,
        };
        materialsResult.push(materialElement);
      }

      // Обработка готовой продукции (счет S28)
      if (kokolS28 != 0) {
        let priceS28 = kokolS28 ? kosumS28 / kokolS28 : 0;
        let productElement = {
          name: item.name,
          value: kokolS28,
          valueSum: kosumS28,
          price: priceS28,
        };
        productsResult.push(productElement);
      }
    }
    
    return { 
        section: title,
        sectionId: currentSectionId,
        materials: materialsResult,  // Материалы по счету S10
        products: productsResult     // Готовая продукция по счету S28
    };
};