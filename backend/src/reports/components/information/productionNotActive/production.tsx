import { ReferenceModel, TypeReference, TypeSECTION } from 'src/interfaces/reference.interface';
import { productionItem } from './productionItem';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';

export const production = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    sequelize: Sequelize,
    hamirs: [],
    stocksService: StocksService
) => {
    
        // Anvar hamir bilan hato bor chog'i
    let result:any[] = [];
    let filteredData:Reference[] = []

    if (data && data.length) {
        filteredData  = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES)
                            .filter((item: Reference) => {
                                if ( item.refValues.typeSection == TypeSECTION.PRODUCTION ) return true
                                return false
                            })
    }   

    for (const item of filteredData) {
        let element = await productionItem(startDate, endDate, item?.id, item.name, sequelize, hamirs, stocksService)

        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: 'PRODUCTION',
        values : [...result]
    }
} 

