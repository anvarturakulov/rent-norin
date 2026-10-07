import { TypePartners, TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { Schet } from 'src/interfaces/report.interface';
import { skladItem } from './skladItem';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const sklad = async(
    data: any,
    startDate: number | null,
    endDate: number | null,
    sectionId: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    schet: Schet,
    enterpriseId?: number | null,
    tmzId?: number | null,
) => {
    
    let result:any[] = [];
    let filteredData:Reference[] = []

    if (schet === Schet.S12) {
        if (data && data.length) {
            filteredData = data
                .filter((item: any) => (
                    item?.typeReference === TypeReference.PARTNERS &&
                    !item.refValues?.markToDeleted &&
                    !item.isFolder &&
                    item.refValues?.typePartners === TypePartners.CLIENTS
                ))
                .filter((item: any) => {
                    if (sectionId !== null) return item.id == sectionId
                    return true
                })
                .filter((item: Reference) => {
                    if (enterpriseId !== null && enterpriseId !== undefined) {
                        return item.enterpriseId === enterpriseId || item.enterpriseId === null;
                    }
                    return true;
                })
        }

        for (const item of filteredData) {
            const elements = await skladItem(data, startDate, endDate, item.id, item.name, stocksService, oborotsService, schet, enterpriseId, tmzId)
            if (Array.isArray(elements) && elements.length > 0) {
                result.push(...elements)
            }
        }

        return {
            reportType: 'SKLAD',
            values : [...result]
        }
    }

    if (data && data.length) {
        filteredData = data
                           .filter((item: any) => (item?.typeReference == TypeReference.STORAGES && !item.refValues?.markToDeleted))
                           .filter((item: any) => (
                                item.refValues?.typeSection == TypeSECTION.STORAGE ||
                                item.refValues?.typeSection == TypeSECTION.COMMON ||
                                item.refValues?.typeSection == TypeSECTION.PRODUCTION
                           ))
                           .filter((item: any) => {
                                if (sectionId !== null) return item.id == sectionId
                                return true
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
        let elements = await skladItem(data, startDate, endDate, item.id, item.name, stocksService, oborotsService, schet, enterpriseId, tmzId)
        if (Array.isArray(elements) && elements.length > 0) {
            result.push(...elements)
        }
    }
    
    return {
        reportType: 'SKLAD',
        values : [...result]
    }
} 

