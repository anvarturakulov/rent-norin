import { UserRoles } from "./user.interface";

export enum ReportType {
    MatOborot = 'MatOborot',
    Personal = 'Personal',
    MediatorPersonal = 'MediatorPersonal',
    DelivererPersonal = 'DelivererPersonal',
    Oborotka = 'Oborotka',
    Clients = 'Clients',
    AktSverka = 'AktSverka',
    OsOborot = 'OsOborot',
    ACCOUNTOPERATIONS = 'ACCOUNTOPERATIONS',
    // Отчеты из inform
    Svod = 'Svod',
    Financial = 'Financial',
    DebitorKreditor = 'DebitorKreditor',
    Foyda = 'Foyda',
    Cash = 'Cash',
    CASHOPERATIONS = 'CASHOPERATIONS',
    Taking = 'Taking',
    Giving = 'Giving',
    SectionBuxgalter = 'Section-buxgalter',
    SectionFilial = 'Section-filial',
    SectionDelivery = 'Section-delivery',
    Sklad = 'Sklad',
    Material = 'Material',
    SectionFounder = 'Section-founder',
    FoydaByProduction = 'FoydaByProduction',
    TmcMaterialNorms = 'TmcMaterialNorms',
    ProductionMaterialVariance = 'ProductionMaterialVariance',
    MaterialPlanning = 'MaterialPlanning',
    ComeMaterialTmzByArticle = 'ComeMaterialTmzByArticle',
    TmzMainWarehouseBalance = 'TmzMainWarehouseBalance',
    ToolsCurrentBalance = 'ToolsCurrentBalance',
    RentalNetProfit = 'RentalNetProfit',
    ContractFulfillment = 'ContractFulfillment',
    ClientsContractsWork = 'ClientsContractsWork',
    RentalUnfulfilledOrders = 'RentalUnfulfilledOrders',
    All = 'All'
}

export interface ReportOptions {
    startDate: number | null,
    endDate: number | null,
    firstReferenceId?: number,
    secondReferenceId?: number ,
    showReport: boolean,
    startReport: boolean,
    schet: Schet,
    partnerType?: 'CLIENTS' | 'SUPPLIERS' | 'DEPARTMENTS',
}

export enum Schet {
    S00 = 'S00', // СЧЕТА ДЛЯ ВВОДА ОСТАТКОВ И ЗАКРЫТИЯ ЗП
    S01 = 'S01', // СЧЕТА УЧЕТА ОСНОВНЫХ СРЕДСТВ
    S02 = 'S02', // НАКОПЛЕННАЯ АМОРТИЗАЦИЯ ОС
    S10 = 'S10', // СЧЕТА УЧЕТА МАТЕРИАЛОВ
    S11 = 'S11', // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ НА СКЛАДЕ
    S12 = 'S12', // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ У КЛИЕНТА (В АРЕНДЕ)
    S13 = 'S13', // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ СУБАРЕНДЫ (У ПАРТНЁРА)
    S20 = 'S20', // СЧЕТА УЧЕТА ОСНОВНОГО ПРОИЗВОДСТВА И СЧЕТА УЧЕТА РАСХОДОВ ПЕРИОДА
    S21 = 'S21', // СЧЕТА УЧЕТА ПОЛУФАБРИКАТОВ СОБСТВЕННОГО ПРОИЗВОДСТВА
    S23 = 'S23', // СЧЕТ УЧЕТА ВСПОМОГАТЕЛЬНОГО ПРОИЗВОДСТВА
    S28 = 'S28', // СЧЕТА УЧЕТА ГОТОВОЙ ПРОДУКЦИИ
    S29 = 'S29', // СЧЕТА УЧЕТА ТОВАРОВ 
    S40 = 'S40', // СЧЕТА К ПОЛУЧЕНИЮ OT КЛИЕНТОВ
    S41 = 'S41', // СЧЕТА К ПОЛУЧЕНИЮ ОТ ЗАКАЗЧИКОВ
    S50 = 'S50', // СЧЕТА УЧЕТА ДЕНЕЖНЫХ СРЕДСТВ В КАССЕ
    S51 = 'S51', // СЧЕТА УЧЕТА ДЕНЕЖНЫХ СРЕДСТВ НА РАСЧЕТНОМ СЧЕТЕ
    S60 = 'S60', // СЧЕТА К ОПЛАТЕ ПОСТАВЩИКАМ И ПОДРЯДЧИКАМ
    S64 = 'S64', // СЧЕТА УЧЕТА РАСЧЕТОВ С ДОСТАВЩИКАМИ
    S66 = 'S66', // СЧЕТА К ПОЛУЧЕНИЮ ОТ УЧРИДИТЕЛЕЙ (расчёты с учредителями)
    S67 = 'S67', // СЧЕТА УЧЕТА ЗАРОБОТНОЙ ПЛАТЫ СОТРУДНИКОВ
    S71 = 'S71', // СЧЕТА УЧЕТА ПОДОТЧЁТНЫХ СУММ
    S65 = 'S65', // СЧЕТА УЧЕТА БОНУСОВ ПОСРЕДНИКОВ (ВОСИТАЧИЛАР)
    S68 = 'S68', // КОШЕЛЕК УЧРИДИТЕЛЕЙ
    S90 = 'S90', // СЧЕТА УЧЕТА ДОХОДОВ
    S91 = 'S91', // СЧЕТА УЧЕТА РАСХОДОВ
    S93 = 'S93', // ПРОЧИЕ ДОХОДЫ (БОШҚА ДАРОМАД)
}   

export interface EntryItem {
    date: number,
    docNumber: number,
    docId: string,
    documentType: DocumentType,
    debet: Schet,
    debetFirstSubcontoId: string,
    debetFirstSubcontoName?: string,
    debetSecondSubcontoId: string,
    debetSecondSubcontoName?: string,
    kredit: Schet,
    kreditFirstSubcontoId: string,
    kreditFirstSubcontoName?: string,
    kreditSecondSubcontoId: string,
    kreditSecondSubcontoName?: string,
    count: number,
    total: number,
    description: string,
    fullDescription?: string,
}


export enum OborotType {
    S20 = 'Харажатлар', // СЧЕТА УЧЕТА ОСНОВНОГО ПРОИЗВОДСТВА И СЧЕТА УЧЕТА РАСХОДОВ ПЕРИОДА
    S60 = 'Хамкорлар', // СЧЕТА К ПОЛУЧЕНИЮ И СЧЕТА К ОПЛАТЕ ПОСТАВЩИКАМ И ПОДРЯДЧИКАМ
    S50 = 'Касса', // СЧЕТА УЧЕТА ДЕНЕЖНЫХ СРЕДСТВ В КАССЕ
    S67 = 'Ходимлар иш хакиси'
} 

export interface DashboardReportItem {
    id: number,
    title: string,
    code: string,
}

export enum DEBETKREDIT {
    DEBET = 'DEBET',
    KREDIT = 'KREDIT'
}