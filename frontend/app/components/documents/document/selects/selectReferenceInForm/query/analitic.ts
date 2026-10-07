import { ReferenceModel, TypePartners, TypeReference, TypeSECTION } from "@/app/interfaces/reference.interface"
import { DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { Maindata } from "@/app/context/app.context.interfaces";
import { UserRoles } from "@/app/interfaces/user.interface";


export const analitic = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata ): boolean => {
    
    const { user } = mainData.users;
    const { currentDocument } = mainData.document;
    const userEnterpriseId = user?.enterpriseId;
    
    if (type == 'analitic') {
        if (typeReference == TypeReference.PARTNERS && contentName == DocumentType.LeaveCash) {
            if (currentDocument?.docValues?.isMediator) {
                return !item.isFolder
                    && Boolean(item.refValues?.isMediatorDriver || item.refValues?.isMediatorMaster);
            }
            if (currentDocument?.docValues?.isDepartment) {
                return item.refValues?.typePartners == TypePartners.DEPARTMENTS
            }
            if (currentDocument?.docValues?.isClient) {
                return item.refValues?.typePartners == TypePartners.CLIENTS
            }
           
            return item.refValues?.typePartners == TypePartners.SUPPLIERS 
        }

        if (typeReference == TypeReference.WORKERS) {
            return !item.isFolder
        }

        if (typeReference == TypeReference.DELIVERERS) {
            return !item.isFolder
        }

        if (typeReference == TypeReference.CHARGES && contentName == DocumentType.LeaveCash) {
            return !item.refValues?.longCharge
        }

        // Фильтрация для ComeCashFromClients - показываем только COMMON справочники других организаций без hasBuxgalter
        if (typeReference == TypeReference.STORAGES && contentName == DocumentType.ComeCashFromClients) {
            // Показываем только справочники с typeSection === COMMON
            if (item.refValues?.typeSection !== TypeSECTION.COMMON) {
                return false;
            }
            
            // Исключаем справочники с hasBuxgalter === true (Отдельная касса и отдельная бухгалтерия)
            if (item.refValues?.hasBuxgalter === true) {
                return false;
            }
            
            // Исключаем COMMON справочники организации пользователя
            const itemEntId = item.enterpriseId;
            if (userEnterpriseId !== null && userEnterpriseId !== undefined) {
                return itemEntId !== null && 
                       itemEntId !== undefined && 
                       itemEntId !== userEnterpriseId;
            }
            
            return itemEntId !== null && itemEntId !== undefined;
        }

        if (typeReference === TypeReference.TMZ) {
            return !item.isFolder;
        }

        return true
    }
    return false
}

