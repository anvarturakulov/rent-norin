import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { DocumentType } from 'src/interfaces/document.interface';
import { Sequelize } from 'sequelize-typescript';
import { Document } from 'src/documents/document.model';
import { queryKor } from 'src/reports/querys/queryKor';
import { query } from 'src/reports/querys/query';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { Reference } from 'src/references/reference.model';
import { TypeTMZ } from 'src/interfaces/reference.interface';
import { ReferencesService } from 'src/references/references.service';

export const sectionItem = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    currentSectionId: number, 
    title: string,
    sectionType: 'DELIVERY' | 'FILIAL' | 'BUXGALTER' | 'FOUNDER' | 'PRODUCTION',
    stocksService: StocksService,
    oborotsService: OborotsService,
    referencesService: ReferencesService,
    enterpriseId?: number | null
  ) => {
  
  let maydaSavdoCountAll = 0;
  let maydaSavdoCountBux = 0;
  const maydaSavdoReceiverId = -1;

  let results:any[] = [];
  let filteredData:Reference[] = []

  if (0 && startDate != null && endDate != null) {
    maydaSavdoCountAll = 0;
  }

  if (startDate != null && endDate != null) {
    maydaSavdoCountBux = 0;
  }

  let maydaSavdoCount = maydaSavdoCountAll - maydaSavdoCountBux;
  // Остатки/обороты денег в отчёте по разделу — по S50. S66/S50 для расчётов с учредителями; S68 в плане счетов зарезервирован, проводки на S68 не создаются.

  filteredData = data.filter((item: Reference) => {
    return (
      item?.refValues.typeTMZ == TypeTMZ.PRODUCT && !item.refValues.markToDeleted
    )
  })

  
  
  for (const item of filteredData) {
    const promises = [
      query(Schet.S28, TypeQuery.POKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId), // POKOL
      query(Schet.S28, TypeQuery.KOKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId), // KOKOL
      queryKor(Schet.S28, Schet.S28, TypeQuery.ODK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLD2828
      queryKor(Schet.S28, Schet.S20, TypeQuery.ODK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLD2820
      queryKor(Schet.S28, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLK2828
      queryKor(Schet.S28, Schet.S60, TypeQuery.ODK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // productionImportCol
      queryKor(Schet.S20, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLK2028
      queryKor(Schet.S40, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLK4028
      queryKor(Schet.S41, Schet.S28, TypeQuery.OKK, startDate, endDate, currentSectionId, item.id, null, oborotsService, enterpriseId), // OBKOLK4128
      // query(Schet.S28, TypeQuery.TDKOL, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // TDKOL
      // query(Schet.S28, TypeQuery.TKKOL, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // TKKOL
    ];
  
    const [
      POKOL,
      KOKOL,
      OBKOLD2828,
      OBKOLD2820,
      OBKOLK2828,
      productionImportCol,
      OBKOLK2028,
      OBKOLK4028,
      OBKOLK4128,
      
    ] = await Promise.all(promises);
    
    // const total: boolean = (!POKOL && !KOKOL && !OBKOLD2828 && !OBKOLD2820 && !productionImportCol && !OBKOLK2028 && !OBKOLK4028) 


    let element = {
      name: item.name,
      startBalansCountNon: POKOL,
      prodCountNon: OBKOLD2820,
      moveIncomeCountNon: OBKOLD2828 + productionImportCol,
      saleCountNon: OBKOLK4028,
      saleCountDept: OBKOLK4128, 
      maydaSavdoCount,
      brakCountNon: OBKOLK2028,
      moveOutNon: OBKOLK2828,
      endBalansCountNon: KOKOL,
    }  
    
    if (Object.keys(element).length) {
        results.push(element)
    }
  }

  // Новая логика: получить справочник и проверить isForeign
  let isUsdStorage = false;
  if (currentSectionId !== null) {
    try {
      const reference = await referencesService.getReferenceById(currentSectionId);
      if (reference?.refValues?.isForeign === true) {
        isUsdStorage = true;
      }
    } catch (error) {
      // Если справочник не найден, оставляем isUsdStorage = false
      console.error(`Ошибка при получении справочника ${currentSectionId}:`, error);
    }
  }

  const promises = [
    query(Schet.S50, !isUsdStorage ? TypeQuery.POSUM : TypeQuery.POUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // POSUM
    query(Schet.S50, !isUsdStorage ? TypeQuery.KOSUM : TypeQuery.KOUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId), // KOSUM
    queryKor(Schet.S50, Schet.S40, !isUsdStorage ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // CLIENTSINCOME
    queryKor(Schet.S50, Schet.S41, !isUsdStorage ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // CLIENTSDEPTINCOME
    queryKor(Schet.S50, Schet.S50, !isUsdStorage ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // MOVEINCOME
    queryKor(Schet.S50, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // MOVEOUT
    queryKor(Schet.S20, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // CHARGES часть 1
    queryKor(Schet.S67, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // CHARGES часть 2
    queryKor(Schet.S41, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // FORDEPARTMENTS
    queryKor(Schet.S60, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // FORCLIENTS
    queryKor(Schet.S66, Schet.S50, !isUsdStorage ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId), // FORFOUNDER
  ];

  const [
    POSUM,
    KOSUM,
    INCOME40,
    INCOME41,
    MOVEINCOME,
    MOVEOUT,
    OUTFORCHARGES20,
    OUTFORCHARGES67,
    OUTFORDEPARTMENTS,
    OUTFORSUPPLIERS,
    OUTFORFOUNDER ,
  ] = await Promise.all(promises);

  const CHARGES = OUTFORCHARGES20 + OUTFORCHARGES67;

  if (!(POSUM) && !(INCOME40 + MOVEINCOME) && !(CHARGES + OUTFORDEPARTMENTS + MOVEOUT + OUTFORFOUNDER) && !(KOSUM)) return {};
  
  return {
    section: title,
    sectionId: currentSectionId,
    counts : [...results],
    startBalansSumma: POSUM,
    incomeFromClients: INCOME40,
    incomeFromDepartments: INCOME41,
    moveIncome: MOVEINCOME,
    moveOut: MOVEOUT,
    outForCharges: CHARGES,
    outForSuppliers: OUTFORSUPPLIERS,
    outForDepartments: OUTFORDEPARTMENTS,
    outForFounder: OUTFORFOUNDER,
    allIncome: INCOME40 + MOVEINCOME + INCOME41,
    allOut: CHARGES + OUTFORSUPPLIERS + OUTFORDEPARTMENTS + MOVEOUT + OUTFORFOUNDER ,
    endBalansSumma: KOSUM,
  };
};