import { Sequelize } from 'sequelize-typescript';
import { oborotkaItem } from './oborotkaItem';
import { Schet } from 'src/interfaces/report.interface';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const oborotka = async (
    data: any,
    subcontosList: any,
    startDate: number | null,
    endDate: number | null,
    schet: Schet | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    enterpriseId?: number | null
) => {
    
    let result:any = [];
    let firstList:(number | null)[] = []
    let secondList:(number | null)[] = []
    
    if (subcontosList?.firstList && subcontosList?.firstList.length) {
        // Фильтруем null значения, но сохраняем тип
        firstList = subcontosList.firstList.filter((id: number | null) => id !== null && id !== undefined) as (number | null)[]
    }

    if (subcontosList?.secondList && subcontosList?.secondList.length) {
        // Фильтруем null значения, но сохраняем тип
        secondList = subcontosList.secondList.filter((id: number | null) => id !== null && id !== undefined) as (number | null)[]
    }
    
    let startTime = Date.now()
    
    if (firstList && firstList.length) {
        for (const firstSubcontoId of firstList) {
            let element = await oborotkaItem(data, startDate, endDate, firstSubcontoId, secondList, schet, stocksService, oborotsService, enterpriseId)
            if (Object.keys(element).length>0) {
                result.push(element)
            }
        }
    }
    
    let endTime = Date.now()
    
    return {
        reportType: 'OBOROTKA',
        values : [...result],
        startTime: startTime,
        endTime: endTime,
    }
} 

