import { ReportType, Schet } from '@/app/interfaces/report.interface'
import { TypeReference } from '../../interfaces/reference.interface'


interface Result {
    label: string,
    typeReference: TypeReference
}

export const getOptionsByReportType = (reportType:string, schet: Schet):Result => {
    switch (reportType) {
        case ReportType.Personal:
            return {label:'Ходим', typeReference: TypeReference.WORKERS}
        case ReportType.MediatorPersonal:
            return {label:'Воситачи', typeReference: TypeReference.PARTNERS}
        case ReportType.DelivererPersonal:
            return {label:'Доставщик', typeReference: TypeReference.DELIVERERS}
        case ReportType.MatOborot:
            if (schet === Schet.S12) {
                return { label: 'Мижоз', typeReference: TypeReference.PARTNERS }
            }
            return { label: 'Булим ёки цех', typeReference: TypeReference.STORAGES }
        case ReportType.OsOborot:
            return { label: 'Булим ёки цех', typeReference: TypeReference.STORAGES }
        case ReportType.Clients:
            return { label: 'Булим', typeReference: TypeReference.STORAGES }
        case ReportType.AktSverka:
            return { label: 'Хамкор', typeReference: TypeReference.PARTNERS }
        case ReportType.Oborotka:
            switch(schet) {
                case Schet.S10:
                    return { label: 'Хом ашё', typeReference: TypeReference.STORAGES }    
                case Schet.S20:
                    return { label: 'Харажатлар', typeReference: TypeReference.STORAGES }
                case Schet.S23:
                    return { label: '23 счет', typeReference: TypeReference.STORAGES }
                case Schet.S28:
                    return { label: 'Тайёр махсулот', typeReference: TypeReference.STORAGES }    
                case Schet.S40:
                    return { label: 'Мижозлар', typeReference: TypeReference.PARTNERS }
                case Schet.S41:
                    return { label: 'Ички корхоналар', typeReference: TypeReference.PARTNERS }
                case Schet.S60:
                    return { label: 'Хамкорлар', typeReference: TypeReference.PARTNERS }
                case Schet.S50:
                    return { label: 'Касса', typeReference: TypeReference.STORAGES }
                case Schet.S66:
                    return { label: 'Таъсисчилар', typeReference: TypeReference.STORAGES }
                case Schet.S67:
                    return { label: 'Ходимлар иш хакиси', typeReference: TypeReference.WORKERS }
                case Schet.S71:
                    return { label: 'Жавобгар шахсдаги пул', typeReference: TypeReference.WORKERS }
                case Schet.S65:
                    return { label: 'Воситачилар бонуси', typeReference: TypeReference.PARTNERS }
                case Schet.S64:
                    return { label: 'Доставщиклар', typeReference: TypeReference.DELIVERERS }
                case Schet.S68:
                    return { label: 'Хамёнлар', typeReference: TypeReference.STORAGES }
                default:
                    return { label: 'Ноаник', typeReference: TypeReference.STORAGES }
            }
        default:
            return { label: 'Корхона', typeReference: TypeReference.PARTNERS }
    }
}