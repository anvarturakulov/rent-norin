import { TypeReference, TypeSECTION, TypeTMZ } from 'src/interfaces/reference.interface';
import { foydaItem } from './foydaItem';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { DocumentType } from 'src/interfaces/document.interface';
import { Document } from 'src/documents/document.model';
import { DocumentsService } from 'src/documents/documents.service';

const getValue = (jsonString: string, key: string) => {
    try{
      const object = JSON.parse(jsonString)
      if (key in object) return object[key]
      return undefined
    } catch {
      return undefined
    }
}

export const foyda = async (
    data: any,
    startDate: number | null ,
    endDate: number | null ,
    sequelize: Sequelize,
    deliverys: Reference[],
    stockService: StocksService,
    oborotsService: OborotsService,
    documentsService: DocumentsService,
    enterpriseId?: number | null
) => {
    
    let result:any[] = [];
    let zpUmumBulim = 0;
    let longeChargeUmumBulim = 0;
    let currentPaymentUmumBulim = 0;
    
    const docsComeProduct:Document[] = await documentsService.getAllDocumentsByType(DocumentType.ComeProduct)
    const docsMoveProduct:Document[] = await documentsService.getAllDocumentsByType(DocumentType.MoveProd)

    const arrUmumBulim = data.filter((item: Reference) => item.refValues.typeSection == TypeSECTION.COMMON)
    const idUmumBulim = arrUmumBulim[0].id | 0;

    const arrUmumProduct = data.filter((item: Reference) => {
        const commonProduct = item.refValues.comment ? getValue(item.refValues.comment, 'common') : false
        
        return (
            item.typeReference == TypeReference.TMZ &&
            item.refValues.typeTMZ == TypeTMZ.PRODUCT &&
            commonProduct
        )
    })
    // TMZ всегда глобальные справочники (enterpriseId = null), фильтрация не нужна
    const idUmumProduct = arrUmumProduct[0].id | 0;

    let filteredData:Reference[] = []
    
    filteredData  = data.filter((item: Reference) => item.refValues.typeSection == TypeSECTION.COMMON)
        // Фильтрация STORAGES по enterpriseId для отчетов одного предприятия
        .filter((item: Reference) => {
            if (enterpriseId !== null && enterpriseId !== undefined) {
                // Для STORAGES фильтруем по enterpriseId
                if (item.typeReference === TypeReference.STORAGES) {
                    return item.enterpriseId === enterpriseId || item.enterpriseId === null;
                }
                // Для остальных справочников фильтруем по enterpriseId
                return item.enterpriseId === enterpriseId || item.enterpriseId === null;
            }
            // Для глобальных отчетов показываем все
            return true;
        })

    for (const item of filteredData) {                    
        let element = await foydaItem(data, deliverys, docsComeProduct, docsMoveProduct, startDate, endDate, item.id, item.name, idUmumBulim, idUmumProduct, sequelize, stockService, oborotsService, enterpriseId);
        if (Object.keys(element).length) {
            result.push(element)
        }
    }
    
    return {
        reportType: 'FOYDA',
        values : [...result]
    }
} 

