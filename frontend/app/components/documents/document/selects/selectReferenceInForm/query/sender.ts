import { ReferenceModel, TypePartners, TypeReference, TypeSECTION } from "@/app/interfaces/reference.interface"
import { DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { Maindata } from "@/app/context/app.context.interfaces";
import { UserRoles } from "@/app/interfaces/user.interface";
import { shouldAllowCommonReferenceInDocumentSelect } from '@/app/components/reference/helpers/reference.constants';


export const sender = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata ): boolean => {
    
    const { user } = mainData.users;
    const { currentDocument } = mainData.document;
    const usdStorageId = process.env.NEXT_PUBLIC_USD_STORAGE_ID || -1;
    
    if (type == 'sender') {
        const userRole = user?.role;
        const userEnterpriseId = user?.enterpriseId;
        const itemEnterpriseId = item.enterpriseId;
        const isOwnReference = itemEnterpriseId !== null && itemEnterpriseId !== undefined && itemEnterpriseId === userEnterpriseId;
        const isCommonReference = itemEnterpriseId === null;
        const hasEnterpriseId = itemEnterpriseId != null && itemEnterpriseId !== undefined;
        const isBankReference = item.refValues?.typeSection === TypeSECTION.BANK;
        const belongsToUserOrg = isOwnReference;
        const allowSharedDirectory =
            isCommonReference &&
            shouldAllowCommonReferenceInDocumentSelect(typeReference, item.refValues?.typePartners);
        const isComeFromSupplier =
            contentName == DocumentType.ComeMaterial ||
            contentName == DocumentType.ComeTovar ||
            contentName == DocumentType.ComeTools ||
            contentName == DocumentType.ComeOS;

        // Для ComeCashFromClients с analiticId (клиенты другой организации) пропускаем проверку ролей
        if (contentName == DocumentType.ComeCashFromClients && typeReference == TypeReference.PARTNERS) {
            const partnerType = currentDocument?.docValues?.isPartner
                ? TypePartners.SUPPLIERS
                : TypePartners.CLIENTS;
            if (item.refValues?.typePartners !== partnerType) {
                return false;
            }
            
            const analiticId = currentDocument?.docValues?.analiticId;
            console.log('[sender.ts] ComeCashFromClients filtering:', {
                analiticId,
                itemId: item.id,
                itemName: item.name,
                itemEnterpriseId,
                userEnterpriseId,
                userRole
            });
            
            // Если analiticId выбран - показываем клиентов второй организации
            // Данные уже загружены через API с правильным enterpriseId в useSelectReferenceData
            // Пропускаем проверку ролей, так как клиенты могут быть из другой организации
            if (analiticId && analiticId > 0) {
                // Клиенты второй организации - показываем всех загруженных клиентов
                return true;
            }
            // Если analiticId не выбран, продолжаем со стандартной проверкой ролей ниже
        }

        // Для приходов от поставщика с receiverId (склад другого предприятия) пропускаем проверку ролей для PARTNERS
        if (isComeFromSupplier && typeReference == TypeReference.PARTNERS) {
            // Проверяем, что это поставщик
            if (item.refValues?.typePartners !== TypePartners.SUPPLIERS) {
                return false;
            }
            
            const receiverId = currentDocument?.docValues?.receiverId;
            
            // Если receiverId выбран - показываем поставщиков организации-получателя
            // Данные уже загружены через API с правильным enterpriseId в useSelectReferenceData
            // Пропускаем проверку ролей, так как поставщики могут быть из другой организации
            if (receiverId && receiverId > 0) {
                // Поставщики организации-получателя - показываем всех загруженных поставщиков
                return true;
            }
            // Если receiverId не выбран, продолжаем со стандартной проверкой ролей ниже
        }

        // Role-based filtering for sender references (не применяется для ComeCashFromClients с analiticId и приходов от поставщика с receiverId)
        // For ADMINGLOBAL users: show all references (no additional filtering)
        if (userRole === UserRoles.ADMINGLOBAL) {
            // No filtering, continue to document type checks
        }
        else if (userRole === UserRoles.KASSIRGLOBAL) {
            if (!isOwnReference && !(isCommonReference && isBankReference) && !allowSharedDirectory && !(isCommonReference && belongsToUserOrg)) {
                return false;
            }
        }
        else {
            if (!isOwnReference && !allowSharedDirectory && !(isCommonReference && belongsToUserOrg)) {
                return false;
            }
        }

        if (isComeFromSupplier) {
            return item.refValues?.typePartners == TypePartners.SUPPLIERS;
        }

        if (contentName == DocumentType.ComeProduct ) {
            return (
                item.refValues?.typeSection == TypeSECTION.PRODUCTION
            ) 
        }

        if ( contentName == DocumentType.ComeCashFromClients && typeReference == TypeReference.PARTNERS) {
            const partnerType = currentDocument?.docValues?.isPartner
                ? TypePartners.SUPPLIERS
                : TypePartners.CLIENTS;
            if (item.refValues?.typePartners !== partnerType) {
                return false;
            }
            return true;
        }

        if ( contentName == DocumentType.LeaveProd ) {
            return (
                item.refValues?.typeSection == TypeSECTION.COMMON
            ) 
        }

        if (contentName == DocumentType.LeaveMaterial) {
            return ( 
                item.refValues?.typeSection == TypeSECTION.COMMON
            ) 
        }

        if (contentName == DocumentType.LeaveOnlyOneMaterial) {
            return (
                item.refValues?.typeSection == TypeSECTION.PRODUCTION ||
                item.refValues?.typeSection == TypeSECTION.COMMON
            )
        }

        if (contentName == DocumentType.SaleProd || contentName == DocumentType.SaleMaterial) {
            return (
                item.refValues?.typeSection == TypeSECTION.COMMON &&
                (isCommonReference || hasEnterpriseId)
            ) 
        }

        if (
            (contentName === DocumentType.SaleTovar ||
              contentName === DocumentType.SaleTools ||
              contentName === DocumentType.LeaveTovar) &&
            typeReference === TypeReference.STORAGES
        ) {
            const allowed = user?.allowedStorageIds;

            if (Array.isArray(allowed) && allowed.length > 0) {
                return (
                    item.refValues?.typeSection === TypeSECTION.COMMON &&
                    item.id !== undefined &&
                    allowed.includes(item.id)
                );
            }

            return (
                item.refValues?.typeSection === TypeSECTION.COMMON &&
                item.enterpriseId === userEnterpriseId
            );
        }

        if (contentName == DocumentType.MoveProd) {
            return ( 
                item.refValues?.typeSection == TypeSECTION.STORAGE 
            ) 
        }

        if (contentName == DocumentType.MoveMaterial) {
            return ( 
                item.refValues?.typeSection == TypeSECTION.PRODUCTION  ||
                item.refValues?.typeSection == TypeSECTION.STORAGE ||
                item.refValues?.typeSection == TypeSECTION.COMMON
            ) 
        }

        if (contentName == DocumentType.MoveTools && typeReference === TypeReference.STORAGES) {
            return (
                item.refValues?.typeSection == TypeSECTION.STORAGE ||
                item.refValues?.typeSection == TypeSECTION.COMMON
            );
        }

        if (contentName == DocumentType.LeaveTools && typeReference === TypeReference.STORAGES) {
            const allowed = user?.allowedStorageIds;
            const isStorageOrCommon =
                item.refValues?.typeSection === TypeSECTION.STORAGE ||
                item.refValues?.typeSection === TypeSECTION.COMMON;

            if (Array.isArray(allowed) && allowed.length > 0) {
                return (
                    isStorageOrCommon &&
                    item.id !== undefined &&
                    allowed.includes(item.id)
                );
            }

            return isStorageOrCommon && item.enterpriseId === userEnterpriseId;
        }

        if ((contentName == DocumentType.TransferToolsToClient || contentName == DocumentType.OrderToolsToClient) && typeReference === TypeReference.STORAGES) {
            return item.refValues?.typeSection == TypeSECTION.COMMON;
        }

        if (contentName == DocumentType.TransferSubleaseToolsToClient && typeReference === TypeReference.STORAGES) {
            return item.refValues?.typeSection == TypeSECTION.PARTNER_TOOLS;
        }

        if (contentName == DocumentType.LeaveCash || contentName == DocumentType.MoveCash || contentName == DocumentType.Advance) {
            if (userRole == UserRoles.ADMINGLOBAL || userRole == UserRoles.KASSIRGLOBAL) {
                // Для админов применяем фильтрацию по активной вкладке
                const activeTab = mainData.journal?.activeTab || 'CASH';
                
                if (activeTab === 'BANK') {
                    return item.refValues?.typeSection === TypeSECTION.BANK;
                }

                if (activeTab === 'PLASTIK') {
                    return item.refValues?.typeSection === TypeSECTION.PLASTIK;
                }
                
                if (activeTab === 'CASH') {
                    // Накд: TypeSECTION.CASH && (isForeign === false || isForeign === null)
                    return item.refValues?.typeSection === TypeSECTION.CASH && 
                           (item.refValues?.isForeign === false || item.refValues?.isForeign === null || item.refValues?.isForeign === undefined);
                }
                
                if (activeTab === 'USD') {
                    // USD: TypeSECTION.CASH && isForeign === true
                    return item.refValues?.typeSection === TypeSECTION.CASH && item.refValues?.isForeign === true;
                }
                
                return true;
            }
            
            // Для обычных пользователей применяем фильтрацию по активной вкладке
            const activeTab = mainData.journal?.activeTab || 'CASH';
            
            if (!hasEnterpriseId) {
                return false;
            }
            
            if (activeTab === 'BANK') {
                return item.refValues?.typeSection === TypeSECTION.BANK;
            }

            if (activeTab === 'PLASTIK') {
                return item.refValues?.typeSection === TypeSECTION.PLASTIK;
            }
            
            if (activeTab === 'CASH') {
                // Накд: TypeSECTION.CASH && (isForeign === false || isForeign === null)
                return item.refValues?.typeSection === TypeSECTION.CASH && 
                       (item.refValues?.isForeign === false || item.refValues?.isForeign === null || item.refValues?.isForeign === undefined);
            }
            
            if (activeTab === 'USD') {
                // USD: TypeSECTION.CASH && isForeign === true
                return item.refValues?.typeSection === TypeSECTION.CASH && item.refValues?.isForeign === true;
            }
            
            return hasEnterpriseId && 
                   (item.refValues?.typeSection == TypeSECTION.BANK || item.refValues?.typeSection == TypeSECTION.CASH || item.refValues?.typeSection == TypeSECTION.PLASTIK);
        }

        if (contentName == DocumentType.ServicesFromPartners ) {
            // Если typeReference === STORAGES и isDepartment = true, фильтруем по TypeSECTION.COMMON
            if (typeReference === TypeReference.STORAGES && currentDocument?.docValues?.isDepartment) {
                return item.refValues?.typeSection === TypeSECTION.COMMON;
            }
            // Иначе используем стандартную логику для PARTNERS
            return item.refValues?.typePartners == TypePartners.SUPPLIERS;
        }

        if (contentName == DocumentType.ServicesToClients) {
            return (
                item.refValues?.typeSection == TypeSECTION.COMMON &&
                (isCommonReference || hasEnterpriseId)
            )
        }
        
        // Общая логика для STORAGES при isDepartment = true
        if (typeReference === TypeReference.STORAGES && currentDocument?.docValues?.isDepartment) {
            return item.refValues?.typeSection === TypeSECTION.COMMON;
        }

        return true    
    }
    return false
}

