
import { TypeTMZ } from 'src/interfaces/reference.interface';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { OborotsService } from 'src/oborots/oborots.service';
import { Reference } from 'src/references/reference.model';
import { queryKor } from 'src/reports/querys/queryKor';

export const normaItem = async ( 
  data: any,
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number, 
  title: string, 
  obortsService: OborotsService,
  enterpriseId?: number | null
) => {    

    let result:any[] = []
    let filteredData:Reference[] = []

    const idBuxankaSection = -1;
    const idZagatovka27 = -1;
    const idZagatovka26 = -1;
    const idZagatovka = currentSectionId == idBuxankaSection ? idZagatovka26 : idZagatovka27;
    const countHamirs = await queryKor(Schet.S20, Schet.S21, TypeQuery.OKK, startDate, endDate, currentSectionId, idZagatovka, null, obortsService, enterpriseId);
    
    
    if (data && data.length) {
      filteredData = data.filter((item: any) => item?.typeTMZ == TypeTMZ.MATERIAL)
    }
    
    for (const item of filteredData) {
     
      const rasxod = await queryKor(Schet.S20, Schet.S10, TypeQuery.OKK, startDate, endDate, currentSectionId, item.id, null, obortsService, enterpriseId);
      const referenceNorma = item.refValues.norma;
      const norma = referenceNorma ? referenceNorma * countHamirs: 0;
      const farq = norma - rasxod;  
                    
      if (rasxod != 0) {
        let element = {
          name: item.name,
          rasxod,
          norma,
          farq
        }
        
        if (Object.keys(element).length) {
            result.push(element)
        }
      }
      
    }
    
    return ( 
        {
          section: title,
          items: result,
          countHamirs
        }
    )
    
} 