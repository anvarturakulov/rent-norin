import { TypeTMZ } from 'src/interfaces/reference.interface';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { Document } from 'src/documents/document.model';
import { foydaSubItem } from './foydaSubItem';


export const foydaItem = async ( 
  data: any,
  deliverys: Reference[],
  docsComeProduct: Document[],
  docsMoveProduct: Document[],
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number, 
  title: string,
  idUmumBulim: number, 
  idUmumProduct: number,
  sequelize: Sequelize,
  stockService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {

  let filteredData:Reference[] = []
  let result:any[] = []

  if (data && data.length) {
    filteredData = data.filter((item: Reference)=> {
                  return (item.refValues.typeTMZ == TypeTMZ.PRODUCT && !item.refValues.markToDeleted)
    })
  }

  for (const item of filteredData) {
    if (item.id != idUmumProduct) {
      const element = await foydaSubItem(data, docsComeProduct, docsMoveProduct, deliverys, startDate, endDate, currentSectionId, item.id, item.name, item.refValues.comment, idUmumBulim, idUmumProduct, sequelize, stockService, oborotsService, enterpriseId)
      if (Object.keys(element).length) {
        result.push(element)
      }
    }
    
  }
    
  return (
    {
      section: title,
      sectionId: currentSectionId,
      subItems: [...result]
    }
  )
} 