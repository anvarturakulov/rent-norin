import { ReferenceModel, TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { sectionItem } from './sectionItem';
import { Document } from 'src/documents/document.model';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { ReferencesService } from 'src/references/references.service';

export const section = async (
    sectionType: 'DELIVERY' | 'FILIAL' | 'BUXGALTER' | 'FOUNDER',
    data: any,
    startDate: number | null,
    endDate: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    referencesService: ReferencesService,
    enterpriseId?: number | null
) => {
    
    let result:any[] = [];
    let filteredData:Reference[] = []

    if (data && data.length) {
        filteredData  = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES && !item.refValues.markToDeleted)
                            .filter((item: Reference) => {
                                if (sectionType == 'FILIAL') return item.refValues.typeSection == TypeSECTION.PRODUCTION
                                if (sectionType == 'BUXGALTER') return (item.refValues.typeSection == TypeSECTION.CASH 
                                                                    || item.refValues.typeSection == TypeSECTION.BANK
                                                                    || item.refValues.typeSection == TypeSECTION.PLASTIK
                                                                    || item.refValues.typeSection == TypeSECTION.COMMON
                                                                )
                                if (sectionType == 'FOUNDER') return item.refValues.typeSection == TypeSECTION.FOUNDER
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
        let element = await sectionItem(data, startDate, endDate, item.id, item.name, sectionType, stocksService, oborotsService, referencesService, enterpriseId)
        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: `SECTION-${sectionType}`,
        values : [...result]
    }
} 

