import { DashboardReportItem } from "../interfaces/report.interface";

/** Новые inform-отчёты: показываются ролям, у которых уже есть доступ к любому inform-отчёту */
export const INFORM_REPORTS_AUTO_GRANT: readonly string[] = [
    'FurnitureOrders',
    'ContractFulfillment',
    'ClientsContractsWork',
    'RentalUnfulfilledOrders',
    // 'RentalExpectedIncome',
];

export const DashboardReportData:Array<DashboardReportItem> = [
    
    {
        title: 'Умум жамланма',
        code: 'SvodBYCompany',
        id: 15,
    },
    
    {
        id: 2,
        title: 'Баланс',
        code: 'DebitorKreditor',
    },
    {
        title: 'Пул окими - умум корхона буйича',
        code: 'Financial',
        id: 1,
    },
    {
        id: 4,
        title: 'Касса жадвал',
        code: 'Cash',
    },
    
    {
        id: 7,
        title: 'Касса карточка',
        code: 'Section-buxgalter',
    },
    {
        id: 31,
        title: 'Хисоб карточкаси',
        code: 'ACCOUNTOPERATIONS',
    },
    {
        title: 'Касса операциялар',
        code: 'CASHOPERATIONS',
        id: 1
    },
    {
        id: 3,
        title: 'Фойда хисоби ',
        code: 'FoydaByProduction',
    },

    {
        id: 36,
        title: 'Фойда хисоби (заказлар буйича)',
        code: 'FoydaByOrder',
    },

    {
        id: 10,
        title: 'Омборхона',
        code: 'Sklad',    
    },
    {
        id: 22,
        title: 'Материаллар нормалари',
        code: 'TmcMaterialNorms',
    },  
    {
        id: 27,
        title: 'Отчет по предприятиям (межпредприятийные операции)',
        code: 'EnterpriseIntercompanyReport',
    },
    {
        id: 29,
        title: 'Материаллар чикими - цехлар буйича',
        code: 'MaterialByDepartment',
    },
    {
        id: 30,
        title: 'Ишлаб чикариш: факт ва норма (материаллар)',
        code: 'ProductionMaterialVariance',
    },
    {
        id: 32,
        title: 'Материаллар режалаштириш',
        code: 'MaterialPlanning',
    },
    {
        id: 33,
        title: 'Материал приходи (артикул)',
        code: 'ComeMaterialTmzByArticle',
    },
    {
        id: 34,
        title: 'Солиштирма далолатнома',
        code: 'AktSverka',
    },
    {
        id: 35,
        title: 'Таъминотчи — товар ва материаллар',
        code: 'SupplierGoods',
    },
    {
        id: 37,
        title: 'Асосий омбор — ТМЗ қолдиқлари',
        code: 'TmzMainWarehouseBalance',
    },
    {
        id: 38,
        title: 'Заявкалар (хужжатлар)',
        code: 'FurnitureOrders',
    },
    {
        id: 39,
        title: 'Ижара — кутилаётган даромад',
        code: 'RentalExpectedIncome',
    },
    {
        id: 40,
        title: 'Ускуналар — жорий қолдиқ',
        code: 'ToolsCurrentBalance',
    },
    {
        id: 41,
        title: 'Ижара соф фойдаси',
        code: 'RentalNetProfit',
    },
    {
        id: 42,
        title: 'Субаренда — ҳамкор бўйича',
        code: 'SubleasePartnerMargin',
    },
    {
        id: 43,
        title: 'Субаренда — кутилаётган даромад',
        code: 'SubleaseExpectedIncome',
    },
    {
        id: 44,
        title: 'Шартномалар ижроси',
        code: 'ContractFulfillment',
    },
    {
        id: 45,
        title: 'Мижозлар ва шартномалар',
        code: 'ClientsContractsWork',
    },
    {
        id: 46,
        title: 'Ижара — бажарилмаган буюртмалар',
        code: 'RentalUnfulfilledOrders',
    },
]