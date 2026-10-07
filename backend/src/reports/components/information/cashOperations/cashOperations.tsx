import { TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { cashOperationsItem } from './cashOperationsItem';
import { Reference } from 'src/references/reference.model';
import { EntriesService } from 'src/entries/entries.service';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { ReferencesService } from 'src/references/references.service';

export const cashOperations = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    entriesService: EntriesService,
    stocksService: StocksService,
    oborotsService: OborotsService,
    referencesService: ReferencesService,
    enterpriseId?: number | null

 ) => {
    
    let result:any[] = [];
    let filteredData:any[] = []
    
    if (data && data.length > 0 ) {
        filteredData = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES && !item.refValues?.markToDeleted)
                           .filter((item: Reference) => {
                                if ( item.refValues?.typeSection == TypeSECTION.CASH ||
                                    item.refValues?.typeSection == TypeSECTION.BANK ||
                                    item.refValues?.typeSection == TypeSECTION.PLASTIK
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
        let element = await cashOperationsItem(startDate, endDate, item.id, item.name, entriesService, stocksService, oborotsService, referencesService, enterpriseId)
        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: 'CASHOPERATIONS',
        values : [...result]
    }
} 

