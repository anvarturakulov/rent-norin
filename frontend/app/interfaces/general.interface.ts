export type ContentType = 'document' | 'reference' | 'servis' | 'report' | 'informReport' | 'order' | 'gate-income' | 'gate-outcome' | 'furniture-orders' | 'furniture-my-works' | 'furniture-production-board' | 'furniture-stage-board' | 'furniture-contracts' | 'furniture-cutting-balances' | 'furniture-work-time-report' | 'rental-contracts'

export interface DashboardSettings {
    mainPage: boolean,
    activeMenuKey: string,
    activeMenuTitle: string,
    activeMenuType: ContentType,
    userId: string
}

export enum ServiceType {
    Users = 'Фойдаланувчилар',
    Options = 'Дастур хусусиятлари',
    DeleteDocs = 'Хужжатларни учириш',
    Enterprises = 'Корхоналар',
    PricingPolicy = 'Нарх сиёсати',
}

export enum GateType {
    Income = 'gate-income',
    Outcome = 'gate-outcome',
}

export enum FurnitureType {
    Orders  = 'furniture-orders',
    MyWorks = 'furniture-my-works',
    ProductionBoard = 'furniture-production-board',
    StageBoard = 'furniture-stage-board',
    Contracts = 'furniture-contracts',
    CuttingBalances = 'furniture-cutting-balances',
    WorkTimeReport = 'furniture-work-time-report',
}

export type MessageType = 'success' | 'error' | 'warm'



