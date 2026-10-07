import { Sequelize } from 'sequelize-typescript';
import { Document } from 'src/documents/document.model';
import { DocSTATUS } from 'src/interfaces/document.interface';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { query } from 'src/reports/querys/query';
import { queryKor } from 'src/reports/querys/queryKor';
import { StocksService } from 'src/stocks/stocks.service';

export const productionItem = async ( 
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number, 
  title: string, 
  sequelize: Sequelize,
  hamirs: Document[],
  stocksService: StocksService
) => {
   
  let currentHamirs, currentZagatovka, colHamirs, colZagatovka; 
  let colNon = 0;
  let zuvalaKPI = 0;

    // if (hamirs && hamirs.length) {
    //     currentHamirs = hamirs.filter((item: Document) => {
    //         return (item.docValues.senderId == currentSectionId && item.docStatus == DocSTATUS.PROVEDEN && item.zuvala && !item.fromHamirchi)
    //     })
    //     currentZagatovka = hamirs.filter((item: Hamir) => {
    //         return (String(item.sectionId) == currentSectionId && item.proveden && item.zuvala && item.fromHamirchi)
    //     })

    //     // colNon = currentHamirs.reduce((acc:number, item: HamirModel) => {acc + item.zuvala, 0)
    //     currentHamirs.forEach((item:Hamir) => {
    //         if (item.zuvala) colNon += item.zuvala
    //     });
        
    //     colHamirs = currentHamirs.length
    //     colZagatovka = currentZagatovka.length
    //     if (colHamirs) {
    //         zuvalaKPI = (colNon / colHamirs)
    //     }
    // }
    

    let idForBuxanka = -1
// Anvar shu erda hato bor

    // const PDKOL = await query(Schet.S28, TypeQuery.PDKOL, startDate, endDate, currentSectionId, null, null, sequelize, stocksService);
    // const PDKOLbux = await query(Schet.S28, TypeQuery.PDKOL, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize, stocksService);
    
    // const PKKOL = await query(Schet.S28, TypeQuery.PKKOL, startDate, endDate, currentSectionId, null, null, sequelize, stocksService);
    // const PKKOLbux = await query(Schet.S28, TypeQuery.PKKOL, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize, stocksService);

    // const OBKOLD2828 = await queryKor(Schet.S28, Schet.S28, TypeQuery.ODK, startDate, endDate, currentSectionId, null, null, sequelize);
    // const OBKOLD2828bux = await queryKor(Schet.S28, Schet.S28, TypeQuery.ODK, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize);
    
    // const OBKOLD2820 = await queryKor(Schet.S28, Schet.S20, TypeQuery.ODK, startDate, endDate, currentSectionId, null, null, sequelize);;
    // const OBKOLD2820bux = await queryKor(Schet.S28, Schet.S20, TypeQuery.ODK, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize);
    
    // const OBKOLK2828 = await queryKor(Schet.S28, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, null, null, sequelize);
    // const OBKOLK2828bux = await queryKor(Schet.S28, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize);
    
    // const OBKOLK2028 = await queryKor(Schet.S20, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, null, null, sequelize);
    // const OBKOLK2028bux = await queryKor(Schet.S20, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize);

    // const OBKOLK4028 = await queryKor(Schet.S40, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, null, null, sequelize);
    // const OBKOLK4028bux = await queryKor(Schet.S40, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize);
   
    // const TDKOL = await query(Schet.S28, TypeQuery.TDKOL, startDate, endDate, currentSectionId, null, null, sequelize, stocksService);
    // const TDKOLbux = await query(Schet.S28, TypeQuery.TDKOL, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize, stocksService);
    
    // const TKKOL = await query(Schet.S28, TypeQuery.TKKOL, startDate, endDate, currentSectionId, null, null, sequelize, stocksService);
    // const TKKOLbux = await query(Schet.S28, TypeQuery.TKKOL, startDate, endDate, currentSectionId, idForBuxanka, null, sequelize, stocksService);

  return (
    // {
    //   section: title,
    //   countHamirs: colHamirs,
    //   countZagatovka: colZagatovka,
    //   zuvalaKPI: zuvalaKPI,
    //   startBalansCountNon: PDKOL-PKKOL-(PDKOLbux-PKKOLbux),
    //   startBalansCountBux: PDKOLbux-PKKOLbux,
    //   prodCountNon: OBKOLD2820-OBKOLD2820bux,
    //   prodCountBux: OBKOLD2820bux,
    //   moveIncomeCountNon: OBKOLD2828-OBKOLD2828bux,
    //   moveIncomeCountBux: OBKOLD2828bux,
    //   saleCountNon: OBKOLK4028-OBKOLK4028bux,
    //   saleCountBux: OBKOLK4028bux,
    //   brakCountNon: OBKOLK2028-OBKOLK2028bux,
    //   brakCountBux: OBKOLK2028bux,
    //   moveOutNon: OBKOLK2828-OBKOLK2828bux,
    //   moveOutBux: OBKOLK2828bux,
    //   endBalansCountNon: PDKOL - PKKOL + TDKOL - TKKOL - (PDKOLbux - PKKOLbux + TDKOLbux - TKKOLbux),
    //   endBlanasCountBux: PDKOLbux - PKKOLbux + TDKOLbux - TKKOLbux, 
    // }
     {} 
  )
} 