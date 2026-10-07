import { DocumentType } from "../../interfaces/document.interface";
import { ContentType, ServiceType } from "../../interfaces/general.interface";
import { TypeReference } from '../../interfaces/reference.interface';
import { ReportType} from "../../interfaces/report.interface";

export const getKeyEnum = (val:string, contentType: ContentType):string =>{
    switch (contentType) {
        case 'document':
            // Обработка специального значения для всех документов
            if (val === 'ALL_DOCUMENTS') {
                return 'ALL_DOCUMENTS';
            }
            return Object.keys(DocumentType)[Object.values(DocumentType).indexOf(val as unknown as DocumentType)]
        case 'reference':
            return Object.keys(TypeReference)[Object.values(TypeReference).indexOf(val as unknown as TypeReference)]
        case 'servis':
            return Object.keys(ServiceType)[Object.values(ServiceType).indexOf(val as unknown as ServiceType)]
        case 'report':
            return Object.keys(ReportType)[Object.values(ReportType).indexOf(val as unknown as ReportType)]
        default:
            return 'Error'
    }
}

