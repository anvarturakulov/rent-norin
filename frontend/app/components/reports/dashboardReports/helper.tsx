import { Financial } from "./components/financial/financial"
import { Foyda } from "./components/foyda/foyda"
import {Cash} from "./components/cash/cash"
import {Taking} from './components/taking/taking'
import { Section } from "./components/section/section"
import { Giving } from "./components/giving/giving"
import { Sklad } from "./components/sklad/sklad"
import { Svod } from "./components/svod/svod"
import { Norma } from "./components/norma/norma"
import { Material } from "./components/material/material"
import { DebitorKreditor } from "./components/debitorKreditor/debitorKreditor"
import { DefaultReports } from "./components/defaultReports/defaultReports"
import { CashOperations } from "./components/cashOperations/cashOperations"
import { FoydaByProduction } from "./components/foydaByProduction/foydaByProduction"
import { FoydaByOrder } from "./components/foydaByOrder/foydaByOrder"
import { TmcMaterialNorms } from "./components/tmcMaterialNorms/tmcMaterialNorms"
import { EnterpriseIntercompanyReport } from "./components/enterpriseIntercompanyReport/enterpriseIntercompanyReport"
import { MaterialByDepartment } from "./components/materialByDepartment/materialByDepartment"
import { ProductionMaterialVariance } from "./components/productionMaterialVariance/productionMaterialVariance"
import { AccountOperations } from "./components/accountOperations/accountOperations"
import { MaterialPlanning } from "./components/materialPlanning/materialPlanning"
import { ComeMaterialTmzByArticle } from "./components/comeMaterialTmzByArticle/comeMaterialTmzByArticle"
import { AktSverka } from "./components/aktSverka/aktSverka"
import { SupplierGoods } from "./components/supplierGoods/supplierGoods"
import { TmzMainWarehouseBalance } from "./components/tmzMainWarehouseBalance/tmzMainWarehouseBalance"
import { FurnitureOrders } from "./components/furnitureOrders/furnitureOrders"
import { ContractFulfillment } from "./components/contractFulfillment/contractFulfillment"
import { ClientsContractsWork } from "./components/clientsContractsWork/clientsContractsWork"
import { RentalExpectedIncome } from "./components/rentalExpectedIncome/rentalExpectedIncome"
import { ToolsCurrentBalance } from "./components/toolsCurrentBalance/toolsCurrentBalance"
import { RentalNetProfit } from "./components/rentalNetProfit/rentalNetProfit"
import { SubleasePartnerMargin } from "./components/subleasePartnerMargin/subleasePartnerMargin"
import { SubleaseExpectedIncome } from "./components/subleaseExpectedIncome/subleaseExpectedIncome"
import { RentalUnfulfilledOrders } from "./components/rentalUnfulfilledOrders/rentalUnfulfilledOrders"

export const getReportByType = (dashboardCurrentReportType: string, informData: any) : JSX.Element => {
    const normalizedType = dashboardCurrentReportType?.trim();
    
    switch (normalizedType) {
        case 'Svod':
        case 'SvodBYCompany':
            return <Svod data={informData} />
        case 'Financial':
            return <Financial data={informData}/>
        case 'DebitorKreditor':
            return <DebitorKreditor data={informData}/>
        case 'Foyda':
            return <Foyda data={informData}/>
        case 'Cash':
            return <Cash data={informData}/>
        case 'CASHOPERATIONS':
            return <CashOperations data={informData} />
        case 'Taking':
            return <Taking data={informData} />
        case 'Giving':
            return <Giving data={informData}/>
        case 'Section-buxgalter':
            return <Section data={informData} sectionType='buxgalter'/>
        case 'Section-filial':
            return <Section data={informData} sectionType='filial'/>
        case 'Section-delivery':
            return <Section data={informData} sectionType='delivery'/>
        case 'Sklad':
            return <Sklad data={informData}/>
        // case 'Norma':
        //     return <Norma data={informData}/> 
        case 'AktSverka':
            return <AktSverka />
        case 'SupplierGoods':
            return <SupplierGoods />
        case 'Material':
            return <Material data={informData}/> 
        case 'Section-founder':
            return <Section data={informData} sectionType='founder'/>
        case 'FoydaByProduction':
            return <FoydaByProduction data={informData}/>
        case 'FoydaByOrder':
            return <FoydaByOrder data={informData}/>
        case 'TmcMaterialNorms':
            return <TmcMaterialNorms data={informData}/>
        case 'EnterpriseIntercompanyReport':
            return <EnterpriseIntercompanyReport data={informData}/>
        case 'MaterialByDepartment':
            return <MaterialByDepartment data={informData}/>
        case 'ProductionMaterialVariance':
            return <ProductionMaterialVariance data={informData}/>
        case 'MaterialPlanning':
            return <MaterialPlanning data={informData}/>
        case 'ComeMaterialTmzByArticle':
            return <ComeMaterialTmzByArticle data={informData}/>
        case 'TmzMainWarehouseBalance':
            return <TmzMainWarehouseBalance data={informData}/>
        case 'FurnitureOrders':
            return <FurnitureOrders data={informData}/>
        case 'ContractFulfillment':
            return <ContractFulfillment data={informData}/>
        case 'ClientsContractsWork':
            return <ClientsContractsWork data={informData}/>
        case 'RentalUnfulfilledOrders':
            return <RentalUnfulfilledOrders data={informData}/>
        case 'RentalExpectedIncome':
            return <RentalExpectedIncome />
        case 'ToolsCurrentBalance':
            return <ToolsCurrentBalance data={informData} />
        case 'RentalNetProfit':
            return <RentalNetProfit data={informData} />
        case 'SubleasePartnerMargin':
            return <SubleasePartnerMargin data={informData} />
        case 'SubleaseExpectedIncome':
            return <SubleaseExpectedIncome />
        case 'ACCOUNTOPERATIONS':
            return <AccountOperations />
        case 'All':
            return ( 
                <>
                    <Svod data={informData} />
                    <Foyda data={informData}/>
                    <DebitorKreditor data={informData}/>
                    <Cash data={informData}/>
                    <Financial data={informData}/>
                    <Section data={informData} sectionType='buxgalter'/>
                    <Section data={informData} sectionType='filial'/>
                    <Section data={informData} sectionType='delivery'/>
                    <Sklad data={informData}/>
                    <Norma data={informData}/> 
                    <Material data={informData}/> 
                    <Section data={informData} sectionType='founder'/>
                    <FoydaByProduction data={informData}/>
                    <FoydaByOrder data={informData}/>
                    <TmcMaterialNorms data={informData}/>
                </>
            )
        default:
            console.log('⚠️ [getReportByType] Неизвестный тип отчета, показываем DefaultReports. dashboardCurrentReportType:', dashboardCurrentReportType);
            return <>
                <DefaultReports/>
            </>
        
    }


}