'use client'
import { Schet } from 'src/interfaces/report.interface';
import { oborotka } from './oborotka/oborotka';
import { Entry } from 'src/entries/entry.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const getSubcontosList = async (
    oborotsService: OborotsService,
    schet: Schet | null,
    startDate: number | null,
    endDate: number | null,
    enterpriseId?: number | null
) => {
    if (!schet) {
        return {
            firstList: [],
            secondList: [],
            thirdList: []
        };
    }

    // Получаем subcontos из таблицы Oborot вместо Entry
    // Это гарантирует, что мы получим все subcontos, включая те, которые созданы
    // документами ServicesFromPartners и ZpCalculate
    return await oborotsService.getSubcontosBySchet(schet, startDate, endDate, enterpriseId);
}

export const oborotkaAll = async (
    data: any,
    entrys: Entry[] | undefined,
    startDate: number | null,
    endDate: number | null,
    schet: Schet | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    enterpriseId?: number | null
    ) => {
    
    let result:any[] = [];
    // Используем oborotsService для получения subcontos из таблицы Oborot
    // Это гарантирует, что мы получим все subcontos, включая те, которые созданы
    // документами ServicesFromPartners и ZpCalculate
    let subcontosList = await getSubcontosList(oborotsService, schet, startDate, endDate, enterpriseId)
    

    let oborotkaResult = await oborotka(data, subcontosList, startDate, endDate, schet, stocksService, oborotsService, enterpriseId)
    result.push(oborotkaResult);
    
        
    return {...oborotkaResult}
    
} 