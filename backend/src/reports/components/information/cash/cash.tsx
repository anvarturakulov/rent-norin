import { TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { cashItem } from './cashItem';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { ReferencesService } from 'src/references/references.service';
import { ExchangeService } from 'src/exchange/exchange.service';

export const cash = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    referencesService: ReferencesService,
    enterpriseId?: number | null,
    exchangeService?: ExchangeService
 ) => {
    
    let result:any[] = [];
    let filteredData:any[] = []
    
    if (data && data.length > 0 ) {
        filteredData = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES && !item.refValues.markToDeleted)
            .filter((item: Reference) => {
                if ( item.refValues.typeSection == TypeSECTION.CASH || 
                    item.refValues.typeSection == TypeSECTION.BANK ||
                    item.refValues.typeSection == TypeSECTION.PLASTIK ||
                    item.refValues.typeSection == TypeSECTION.COMMON
                ) return true
                return false
            })
            // Фильтрация по enterpriseId для отчетов одного предприятия
            .filter((item: Reference) => {
                if (enterpriseId !== null && enterpriseId !== undefined) {
                    return item.enterpriseId === enterpriseId || item.enterpriseId === null;
                }
                // Для глобальных отчетов показываем все storages
                return true;
            })
    }
    
    for (const item of filteredData) {
        let element = await cashItem(startDate, endDate, item.id, item.name, stocksService, oborotsService, referencesService, enterpriseId, exchangeService)
        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: 'CASH',
        reportStartDateToBackup: startDate,
        reportEndDateToBackup: endDate,
        values : [...result]
    }
} 

