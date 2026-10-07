import { sklad } from './sklad/sklad';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { Schet } from 'src/interfaces/report.interface';
export const matOborot = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    section: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    schet: Schet,
    enterpriseId?: number | null,
    tmzId?: number | null,
    ) => {
    
    let result:any[] = [];
    let skladResult = await sklad(data, startDate, endDate, section, stocksService, oborotsService, schet, enterpriseId, tmzId)
    // console.log('matOborot - skladResult:', JSON.stringify(skladResult, null, 2));
    result.push(skladResult);

    return result
    
} 