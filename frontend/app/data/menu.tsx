import { DocumentType } from "../interfaces/document.interface";
import { ReportType } from "../interfaces/report.interface";
import {ServiceType, GateType } from "../interfaces/general.interface";
import { MenuItem } from "../interfaces/menu.interface";
import { TypeReference } from "../interfaces/reference.interface";

/**
 * Декларативная конфигурация структуры меню
 * Содержит метаданные: описания, роли по умолчанию, порядок и иерархию
 * Список доступных элементов берется из registry (backend)
 */

export const MenuData:Array<MenuItem> = [
    {
        title: 'Асосий натижалар',
        titleText: 'Жамланма маълумотлар',
        isOpened: true,
        subMenu: []
    },
    {
        title: 'КПП',
        titleText: 'Журнал КПП',
        isOpened: false,
        subMenu: [
            { 
                title: GateType.Income,
                description: 'Кирувчи машиналар',
                type: 'gate-income',
                active: false,
            },
            { 
                title: GateType.Outcome,
                description: 'Чикувчи машиналар',
                type: 'gate-outcome',
                active: false,
            },
            { 
                title: DocumentType.GateIncome, 
                description:'Кириш учун - накладной',
                type: 'document', 
                active: false,
            },
        ],
        // subGroups: [
        //     {
        //         title: 'Накладные',
        //         items: [
        //             { 
        //                 title: DocumentType.GateIncome, 
        //                 description:'Накладная для входа',
        //                 type: 'document', 
        //                 active: false,
        //             },
        //         ]
        //     }
        // ]
    },
    {
        title: 'Хужжатлар',
        titleText: 'Кунлик амаллар руйхати',
        isOpened: false,
        subMenu: [],
        subGroups: [
            {
                title: 'Хамма хужжатлар',
                items: [
                    { 
                        title: 'ALL_DOCUMENTS' as any, 
                        description: 'Хамма хужжатлар',
                        type: 'document', 
                        active: false,
                    }
                ]
            },
            {
                title: 'Ускуналар (ижара)',
                items: [
                    {
                        title: DocumentType.OrderToolsToClient,
                        description: 'Буюртма',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.TransferToolsToClient,
                        description: 'Топшириш',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.ReceiveToolsFromClient,
                        description: 'Кайтариш',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.TransferSubleaseToolsToClient,
                        description: 'Субаренда топшириш',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.ReceiveSubleaseToolsFromClient,
                        description: 'Субаренда қайтариш',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: 'rental-contracts' as any,
                        description: 'Ижара шартномалари',
                        type: 'rental-contracts',
                        active: false,
                    },
                    {
                        title: DocumentType.ComeTools,
                        description: 'Ускуна кирими',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.MoveTools,
                        description: 'Ускуна силжиши',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.LeaveTools,
                        description: 'Ускуна чикими',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.SaleTools,
                        description: 'Ускуна сотуви',
                        type: 'document',
                        active: false,
                    },
                    
                ]
            },
            {
                title: 'Сотув',
                items: [
                { 
                    title: DocumentType.SaleProd, 
                    description:'Махсулот сотуви',
                    type: 'document', 
                    active: false,
                },
                { 
                    title: DocumentType.SaleMaterial, 
                    description:'Хом ашё сотуви',
                    type: 'document', 
                    active: false,
                },
                
                
            ]
            },
            {
                title: 'Тайёр махсулотлар',
                items: [
                        { 
                            title: DocumentType.ComeProduct, 
                            description:'Махсулот кирими',
                            type: 'document', 
                            active: false,
                        },
                        { 
                            title: DocumentType.LeaveProd, 
                            description:'Махсулот чикими',
                            type: 'document', 
                            active: false,
                        },
                    ]
            },
            {
                title: 'Хом ашё',
                items: [
                    { 
                        title: DocumentType.ComeMaterial, 
                        description:'Хом ашё кирими',
                        type: 'document', 
                        active: false,
                    },
                    { 
                        title: DocumentType.MoveMaterial, 
                        description:'Хом ашё силжиши',
                        type: 'document', 
                        active: false,
                    },
                    { 
                        title: DocumentType.LeaveMaterial, 
                        description:'Хом ашё чикими',
                        type: 'document', 
                        active: false,
                    },
                    { 
                        title: DocumentType.LeaveOnlyOneMaterial, 
                        description:'Хом ашё чикими (1 та материал)',
                        type: 'document', 
                        active: false,
                    },
                ]
            },
            {
                title: 'Товарлар',
                items: [
                    {
                        title: DocumentType.ComeTovar,
                        description: 'Товар кирими',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.LeaveTovar,
                        description: 'Товар чикими',
                        type: 'document',
                        active: false,
                    },
                    { 
                        title: DocumentType.SaleTovar, 
                        description:'Товар сотуви',
                        type: 'document', 
                        active: false,
                    },
                ]
            },
            
            {
                title: 'Асосий воситалар',
                items: [
                    {
                        title: DocumentType.ComeOS,
                        description: 'Асосий восита кирими',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.MoveOS,
                        description: 'Асосий восита силжиши',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.LeaveOS,
                        description: 'Асосий восита чикими',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.SaleOS,
                        description: 'Асосий восита сотуви',
                        type: 'document',
                        active: false,
                    },
                    {
                        title: DocumentType.AmortizasiyaOS,
                        description: 'Амортизация ОС',
                        type: 'document',
                        active: false,
                    },
                ]
            },
            {
                title: 'Ярим тайёр махсулотлар',
                items: [
                        { 
                            title: DocumentType.ComeHalfstuff, description:'Я.Т.М кирими',
                            type: 'document', active: false,
                        },
                        { 
                            title: DocumentType.LeaveHalfstuff, description:'Я.Т.М чикими',
                            type: 'document', active: false,
                        },
                        { 
                            title: DocumentType.MoveHalfstuff, description:'Я.Т.М силжиши',
                            type: 'document', active: false,
                        }
                    ]
            },
            
            {
                title: 'Молия',
                items: [
                    { 
                        title: DocumentType.ComeCashFromClients, 
                        description:'Пул кирими',
                        type: 'document', 
                        active: false,
                    },
                    { 
                        title: DocumentType.MoveCash, 
                        description:'Пул силжиши',
                        type: 'document', 
                        active: false,
                    },
                    { 
                        title: DocumentType.LeaveCash, 
                        description:'Пул харажати',
                        type: 'document', 
                        active: false,
                    },
                    {
                        title: DocumentType.Advance,
                        description:'Аванс',
                        type: 'document',
                        active: false,
                    },
                    
                ]
            },
            {
                title: 'Бошка',
                items: [
            { 
                title: DocumentType.ZpCalculate, 
                description:'Иш хаки хисоби',
                type: 'document', 
                active: false,
            },
            {
                title: DocumentType.ServicesFromPartners, 
                description:'Олинган хизматлар',
                type: 'document', 
                active: false,
            },
            {
                title: DocumentType.ServicesToClients,
                description:'Кўрсатилган хизматлар',
                type: 'document',
                active: false,
            },
            { 
                title: DocumentType.TakeProfit, 
                description:'Фойда таксимоти',
                type: 'document', 
                active: false,
            },
                ]
            }
        ]
    },
    {
        title: 'Номлар',
        titleText: 'Курсаткичлар номлари',
        isOpened: false,
        subMenu: [
            { 
                title: TypeReference.TMZ, 
                description:'Товар моддий бойликлар', 
                type: 'reference', 
                active: false,
            },
            {
                title: TypeReference.TMZ_SHORT_NAME,
                description: 'Қисқа номлар (ТМЗ)',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.TMZ_SIZE,
                description: 'Ўлчамлар (ТМЗ)',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.TMZ_COLOR,
                description: 'Ранглар (ТМЗ)',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.TMZ_TEXTURE,
                description: 'Текстуралар (ТМЗ)',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.TMZ_MANUFACTURE,
                description: 'Ишлаб чиқарувчилар (ТМЗ)',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.TMZ_UNIT,
                description: 'Ўлчов бирликлари (ТМЗ)',
                type: 'reference',
                active: false,
            },
            { 
                title: TypeReference.STORAGES, 
                description:'Цех ва омборхоналар',
                type: 'reference', 
                active: false,
            },
            { 
                title: TypeReference.PARTNERS, 
                description:'Хамкорлар', 
                type: 'reference', 
                active: false,
            },
            { 
                title: TypeReference.WORKERS, 
                description:'Ходимлар',
                type: 'reference', 
                active: false,
            },
            {
                title: TypeReference.DELIVERERS,
                description: 'Доставщиклар',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.WORKS,
                description:'Иш турлари',
                type: 'reference',
                active: false,
            },
            {
                title: TypeReference.COMMON_WORKS,
                description: 'Умумий ишлар',
                type: 'reference',
                active: false,
            },
            { 
                title: TypeReference.CHARGES, 
                description:'Харажатлар',
                type: 'reference', 
                active: false,
            },
            {
                title: TypeReference.SERVICES,
                description:'Хизматлар',
                type: 'reference',
                active: false,
            },
            { 
                title: TypeReference.CARS, 
                description:'Автомашиналар',
                type: 'reference', 
                active: false,
            },

            { 
                title: TypeReference.APARTMENTS, 
                description:'Хонадонлар',
                type: 'reference', 
                active: false,
            },

        ]
    },
    {
        title: 'Хисоботлар',
        titleText: 'Фаолият хисоботлари',
        isOpened: false,
        subMenu: [
            { 
                title: ReportType.MatOborot, 
                description:'ТМБ харакати',
                type: 'report', 
                active: false,
            },
            { 
                title: ReportType.OsOborot, 
                description:'Асосий восита харакати',
                type: 'report', 
                active: false,
            },
            { 
                title: ReportType.Oborotka, 
                description:'Умумий айланма',
                type: 'report', 
                active: false,
            },
            { 
                title: ReportType.Personal, 
                description:'Ходимлар иш хакиси',
                type: 'report', 
                active: false,
            },
            { 
                title: ReportType.MediatorPersonal, 
                description:'Воситачилар иш хакиси',
                type: 'report', 
                active: false,
            },
            {
                title: ReportType.DelivererPersonal,
                description: 'Доставщиклар хисоби',
                type: 'report',
                active: false,
            },
            { 
                title: ReportType.AktSverka, 
                description:'Солиштирма далолатнома',
                type: 'report', 
                active: false,
            },
            
        ]
    },
    {
        title: 'Дастур',
        titleText: 'Дастур хусусиятлари',
        isOpened: false,
        subMenu: [
            { 
                title: ServiceType.DeleteDocs, 
                description:'Хужжатларни учириш', 
                type: 'servis', 
                active: false, 
            },
            { 
                title: ServiceType.Users, 
                description:'Фойдаланувчилар', 
                type: 'servis', 
                active: false, 
            },
            { 
                title: ServiceType.Enterprises, 
                description:'Корхоналар', 
                type: 'servis', 
                active: false, 
            },
            { 
                title: ServiceType.Options, 
                description:'Дастур хусусиятлари', 
                type: 'servis', 
                active: false, 
            },
            { 
                title: ServiceType.PricingPolicy, 
                description:'Нарх сиёсати', 
                type: 'servis', 
                active: false, 
            },
        ]
    },
    {
        title: 'Мебель ишлаб чиқариш',
        titleText: 'Заявкалар ва ишлар',
        isOpened: false,
        subMenu: [
            {
                title: 'furniture-orders' as any,
                description: 'Барча заявкалар',
                type: 'furniture-orders',
                active: false,
            },
            {
                title: 'furniture-my-works' as any,
                description: 'Менинг ишларим (цех)',
                type: 'furniture-my-works',
                active: false,
            },
            {
                title: 'furniture-production-board' as any,
                description: 'Ишлар доскаси (цехлар)',
                type: 'furniture-production-board',
                active: false,
            },
            {
                title: 'furniture-stage-board' as any,
                description: 'Заявкалар доскаси (этаплар)',
                type: 'furniture-stage-board',
                active: false,
            },
            {
                title: 'furniture-contracts' as any,
                description: 'Мижозлар билан шартномалар',
                type: 'furniture-contracts',
                active: false,
            },
            {
                title: 'furniture-cutting-balances' as any,
                description: 'Раскрой қолдиқлари',
                type: 'furniture-cutting-balances',
                active: false,
            },
            {
                title: 'furniture-work-time-report' as any,
                description: 'Иш вақти ҳисоботи',
                type: 'furniture-work-time-report',
                active: false,
            },
        ]
    }
]