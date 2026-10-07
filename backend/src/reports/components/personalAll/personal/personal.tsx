import { Sequelize } from 'sequelize-typescript';
import { TypeReference } from 'src/interfaces/reference.interface';
import { Reference } from 'src/references/reference.model';
import { personalItem } from './personalItem';
import { Entry } from 'src/entries/entry.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const personal = async (
    data: any,
    entries:  Entry[],
    startDate: number | null,
    endDate: number | null,
    workerId: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    enterpriseId?: number | null
) => {
    
    let result:any = [];
    let filteredData:Reference[] = []
    
    if (data && data.length) {
        filteredData = data
                    .filter((item: Reference) => item?.typeReference == TypeReference.WORKERS)
                    .filter((item: Reference) => {
                        if (workerId) {
                            return item.dataValues.id == workerId
                        } else return true
                    })
                    // Фильтрация по enterpriseId для отчетов одного предприятия
                    .filter((item: Reference) => {
                        if (enterpriseId !== null && enterpriseId !== undefined) {
                            // Показываем только WORKERS с enterpriseId === enterpriseId или enterpriseId === null (общие)
                            return item.enterpriseId === enterpriseId || item.enterpriseId === null;
                        }
                        // Для глобальных отчетов показываем все
                        return true;
                    })
    }
   
    for (const item of filteredData) {
        let element = await personalItem(data, entries, startDate, endDate, item.id, stocksService, oborotsService, enterpriseId)
            if (Object.keys(element).length>0) {
                result.push(element)
            }
    }
    return {
        reportType: 'PERSONAL',
        values : [...result],
    }
} 

