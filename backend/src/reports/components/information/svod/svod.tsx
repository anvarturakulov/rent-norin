import { TypeReference, TypeSECTION, TypeTMZ } from 'src/interfaces/reference.interface';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { foydaItem } from '../foyda/foydaItem';
import { cashItem } from '../cash/cashItem';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { DocumentType } from 'src/interfaces/document.interface';
import { Document } from 'src/documents/document.model';
import { DocumentsService } from 'src/documents/documents.service';
import { getValuesFromJournal } from './helpers';
import { queryKor } from 'src/reports/querys/queryKor';
import { getSubcontosList } from '../../oborotkaAll/oborotkaAll';
import { Entry } from 'src/entries/entry.model';
import { oborotka } from '../../oborotkaAll/oborotka/oborotka';
import { sklad } from '../../matOborot/sklad/sklad';
import { ReferencesService } from 'src/references/references.service';
import { ExchangeService } from 'src/exchange/exchange.service';

const getValue = (jsonString: string, key: string) => {
    try{
      const object = JSON.parse(jsonString)
      if (key in object) return object[key]
      return undefined
    } catch {
      return undefined
    }
}

export const svod = async (
    data: any,
    startDate: number | null ,
    endDate: number | null ,
    sequelize: Sequelize,
    deliverys: Reference[],
    stocksService: StocksService,
    oborotsService: OborotsService,
    documentsService: DocumentsService,
    entries: Entry[],
    referencesService: ReferencesService,
    enterpriseId?: number | null,
    exchangeService?: ExchangeService
) => {
    
    try {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return {
                reportType: 'SVOD',
                costValues: [],
                cashValues: [],
                clients: [],
                departments: [],
                suppliers: [],
                skladValues: [],
                values: {}
            };
        }

    

    // section for cash === >>>>

    let cashValues:any[] = [];
    let filteredDataCash:any[] = []
    
    if (data && data.length > 0 ) {
        filteredDataCash = data.filter((item: Reference) => item?.typeReference == TypeReference.STORAGES && item.refValues && !item.refValues.markToDeleted)
                           .filter((item: Reference) => {
                                if (!item.refValues) return false;
                                if ( item.refValues.typeSection == TypeSECTION.CASH || 
                                    item.refValues.typeSection == TypeSECTION.BANK ||
                                    item.refValues.typeSection == TypeSECTION.PLASTIK
                                ) return true
                                return false
                           })
                           // Фильтрация по enterpriseId для отчетов одного предприятия
                           .filter((item: Reference) => {
                               if (!item.refValues) return false;
                               if (enterpriseId !== null && enterpriseId !== undefined) {
                                   return item.enterpriseId === enterpriseId || item.enterpriseId === null;
                               }
                               // Для глобальных отчетов показываем все storages
                               return true;
                           })
    }
    
    
    for (const item of filteredDataCash) {
        let element = await cashItem(startDate, endDate, item.id, item.name, stocksService, oborotsService, referencesService, enterpriseId, exchangeService)
        // Добавляем элемент даже если он пустой, чтобы показать что счет существует
        if (element && Object.keys(element).length > 0) {
            cashValues.push(element)
        }
    }
    
    // section for cash <<<< ====

    // section oborotka for S40 - === >>>>>>
    let clientsValues:any[] = [];
    let clientSubcontosList = await getSubcontosList(oborotsService, Schet.S40, startDate, endDate, enterpriseId)
    let clientOborotkaResult = await oborotka(data, clientSubcontosList, startDate, endDate, Schet.S40, stocksService, oborotsService, enterpriseId)
    clientsValues.push(clientOborotkaResult);
    // section oborotka for S40 <<< ====

    // section oborotka for S41 - === >>>>>>
    let departmentsValues:any[] = [];
    let departmentSubcontosList = await getSubcontosList(oborotsService, Schet.S41, startDate, endDate, enterpriseId)
    let departmentOborotkaResult = await oborotka(data, departmentSubcontosList, startDate, endDate, Schet.S41, stocksService, oborotsService, enterpriseId)
    departmentsValues.push(departmentOborotkaResult);
    // section oborotka for S41 <<< ====

    // section oborotka for S60 - === >>>>>>
    let suppliersValues:any[] = [];
    let supplierSubcontosList = await getSubcontosList(oborotsService, Schet.S60, startDate, endDate, enterpriseId)
    let supplierOborotkaResult = await oborotka(data, supplierSubcontosList, startDate, endDate, Schet.S60, stocksService, oborotsService, enterpriseId)
    suppliersValues.push(supplierOborotkaResult);
    // section oborotka for S60 <<< ====


    const leaveCashForCharges = await queryKor(Schet.S20, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForZp = await queryKor(Schet.S67, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForMediator = await queryKor(Schet.S65, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForDeliverer = await queryKor(Schet.S64, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForFounder = await queryKor(Schet.S66, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForClients = await queryKor(Schet.S40, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForSuppliers = await queryKor(Schet.S60, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const leaveCashForDepartments = await queryKor(Schet.S41, Schet.S50, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const totalLeaveCash = leaveCashForCharges + leaveCashForZp + leaveCashForMediator + leaveCashForDeliverer + leaveCashForFounder + leaveCashForClients + leaveCashForSuppliers + leaveCashForDepartments;
    const incomeFromClients = await queryKor(Schet.S50, Schet.S40, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const incomeFromSuppliers = await queryKor(Schet.S50, Schet.S60, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const incomeFromDepartments = await queryKor(Schet.S50, Schet.S41, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const totalIncome = incomeFromClients + incomeFromSuppliers + incomeFromDepartments;

    const calculatedZp = await queryKor(Schet.S20, Schet.S67, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const calculatedMediator = await queryKor(Schet.S20, Schet.S65, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);
    const calculatedServices = await queryKor(Schet.S20, Schet.S60, TypeQuery.ODS, startDate, endDate, null, null, null, oborotsService, enterpriseId);

        const result = {
            reportType: 'SVOD',
            cashValues: [...cashValues],
            clients: [...clientsValues],
            departments: [...departmentsValues],
            suppliers: [...suppliersValues],
            // skladValues: [...skladValues],
            values : {
                leaveCashForCharges,
                leaveCashForZp,
                leaveCashForMediator,
                leaveCashForDeliverer,
                leaveCashForClients,
                leaveCashForSuppliers,
                leaveCashForDepartments,
                leaveCashForFounder,
                incomeFromClients,
                incomeFromSuppliers,
                incomeFromDepartments,
                totalIncome,
                totalLeaveCash,
                calculatedZp,
                calculatedMediator,
                calculatedServices
            }
        };
        
        
        return result;
    } catch (error) {
        console.error('Ошибка в функции svod:', error);
        return {
            reportType: 'SVOD',
            costValues: [],
            cashValues: [],
            clients: [],
            departments: [],
            suppliers: [],
            skladValues: [],
            values: {}
        };
    }
} 

