import { ReferenceModel, TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { normaItem } from './normaItem';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { OborotsService } from 'src/oborots/oborots.service';

export const norma = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    enterpriseId?: number | null
) => {
    
    let result:any[] = [];
    let filteredData:any[] = []
    
    if (data && data.length) {
        filteredData  = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES)
                            .filter((item: Reference) => !item?.refValues.markToDeleted)
                            .filter((item: Reference) => {
                                if ( item.refValues.typeSection == TypeSECTION.STORAGE ) return true
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
        let element = await normaItem(data, startDate, endDate, item.id, item.name, oborotsService, enterpriseId)
        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: 'NORMA',
        values : [...result]
    }
} 

