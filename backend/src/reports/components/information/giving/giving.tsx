import { Reference } from 'src/references/reference.model';
import { givingItem } from './givingItem';
import { OborotsService } from 'src/oborots/oborots.service';
import { TypeReference } from 'src/interfaces/reference.interface';

export const giving = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    enterpriseId?: number | null
    ) => {
    
    let result:any[] = [];
    let filteredData:any[] = []

    if (data && data.length > 0 ) {
        filteredData = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES && !item.refValues.markToDeleted)
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
        let element = await givingItem(startDate, endDate, item?.id, item.name, oborotsService, enterpriseId)
        if (Object.keys(element).length) {
            result.push(element)
        }
    }

    return {
        reportType: 'GIVING',
        values : [...result]
    }
} 

