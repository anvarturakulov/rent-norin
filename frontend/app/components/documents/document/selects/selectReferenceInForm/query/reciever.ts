import { ReferenceModel, TypePartners, TypeReference, TypeSECTION } from "@/app/interfaces/reference.interface"
import { DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { Maindata } from "@/app/context/app.context.interfaces";
import { UserRoles } from "@/app/interfaces/user.interface";


export const reciever = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata ): boolean => {
    
    const { user } = mainData.users;
    const { currentDocument } = mainData.document;
    
    if (type == 'receiver') {

        const userRole = user?.role;
        const userEnterpriseId = user?.enterpriseId;
        const itemEnterpriseId = item.enterpriseId;
        const isOwnReference = itemEnterpriseId !== null && itemEnterpriseId !== undefined && itemEnterpriseId === userEnterpriseId;
        const isCommonReference = itemEnterpriseId === null;
        const isBankReference = item.refValues?.typeSection === TypeSECTION.BANK;
        const belongsToUserOrg = isOwnReference;

        if (contentName == DocumentType.ComeTools && typeReference === TypeReference.STORAGES) {
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

        if (contentName === DocumentType.ComeTovar && typeReference === TypeReference.STORAGES) {
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

        if (contentName == DocumentType.ComeProduct) {
            if (typeReference === TypeReference.STORAGES) {
                return (
                    item.refValues?.typeSection == TypeSECTION.COMMON &&
                    item.enterpriseId === userEnterpriseId
                );
            }
        }

        if (contentName == DocumentType.ComeMaterial) {
            if (typeReference === TypeReference.STORAGES) {
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

            return (
                item.refValues?.typeSection == TypeSECTION.COMMON
            ) 
        }
        
        if (contentName == DocumentType.ServicesFromPartners) {
            return (
                item.refValues?.typeSection == TypeSECTION.COMMON ||
                item.refValues?.typeSection == TypeSECTION.PRODUCTION
            )
        }
        
        if (contentName == DocumentType.ComeCashFromClients) {
            // Применяем фильтрацию по активной вкладке
            const activeTab = mainData.journal?.activeTab || 'CASH';
            
            if (userRole == UserRoles.ADMINGLOBAL || userRole == UserRoles.KASSIRGLOBAL) {
                // Для админов применяем фильтрацию по активной вкладке
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
            if (!belongsToUserOrg) {
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
            
            return belongsToUserOrg && (item.refValues?.typeSection == TypeSECTION.BANK || item.refValues?.typeSection == TypeSECTION.CASH || item.refValues?.typeSection == TypeSECTION.PLASTIK);
        }

        
        if (contentName == DocumentType.ServicesToClients) {
            return item.refValues?.typePartners == TypePartners.CLIENTS;
        }

        if (contentName == DocumentType.SaleProd || contentName == DocumentType.SaleMaterial || contentName == DocumentType.SaleTovar || contentName == DocumentType.SaleTools || contentName == DocumentType.TransferToolsToClient || contentName == DocumentType.OrderToolsToClient || contentName == DocumentType.TransferSubleaseToolsToClient) {
            // Если typeReference === STORAGES и isDepartment = true, фильтруем по TypeSECTION.COMMON
            // но исключаем справочники с enterpriseId === user.enterpriseId
            if (typeReference === TypeReference.STORAGES && currentDocument?.docValues?.isDepartment) {
                return (
                    item.refValues?.typeSection === TypeSECTION.COMMON &&
                    item.enterpriseId !== user?.enterpriseId
                );
            }
            if (typeReference === TypeReference.WORKERS) {
                return true;
            }
            if (contentName == DocumentType.SaleMaterial && currentDocument?.docValues?.isPartner) {
                return item.refValues?.typePartners == TypePartners.SUPPLIERS;
            }
            return item.refValues?.typePartners == TypePartners.CLIENTS;
        }
        
        // Общая логика для STORAGES при isDepartment = true
        if (typeReference === TypeReference.STORAGES && currentDocument?.docValues?.isDepartment) {
            return item.refValues?.typeSection === TypeSECTION.COMMON;
        }
                
        
        if (contentName == DocumentType.MoveProd) {
            return ( 
                item.refValues?.typeSection == TypeSECTION.COMMON  ||
                item.refValues?.typeSection == TypeSECTION.STORAGE 
            ) 
        }

        if (contentName == DocumentType.MoveMaterial) {
            return (
                (item.refValues?.typeSection == TypeSECTION.PRODUCTION ||
                 item.refValues?.typeSection == TypeSECTION.STORAGE ||
                 item.refValues?.typeSection == TypeSECTION.COMMON) &&
                item.enterpriseId === userEnterpriseId
            );
        }

        if (contentName == DocumentType.MoveTools) {
            return (
                (item.refValues?.typeSection == TypeSECTION.STORAGE ||
                 item.refValues?.typeSection == TypeSECTION.COMMON) &&
                item.enterpriseId === userEnterpriseId
            );
        }

        if (contentName == DocumentType.ReceiveToolsFromClient && typeReference === TypeReference.STORAGES) {
            return (
                item.refValues?.typeSection == TypeSECTION.COMMON &&
                item.enterpriseId === userEnterpriseId
            );
        }

        if (contentName == DocumentType.ReceiveSubleaseToolsFromClient && typeReference === TypeReference.STORAGES) {
            return (
                item.refValues?.typeSection == TypeSECTION.PARTNER_TOOLS &&
                item.enterpriseId === userEnterpriseId
            );
        }

        if (contentName == DocumentType.LeaveMaterial ) {
            if (typeReference === TypeReference.STORAGES) {
                return (
                    item.refValues?.typeSection == TypeSECTION.COMMON &&
                    item.enterpriseId === userEnterpriseId
                );
            }
        }

        if (contentName == DocumentType.LeaveTools || contentName == DocumentType.LeaveTovar || contentName == DocumentType.LeaveOnlyOneMaterial) {
            if (typeReference === TypeReference.STORAGES) {
                return (
                    (item.refValues?.typeSection == TypeSECTION.PRODUCTION ||
                     item.refValues?.typeSection == TypeSECTION.COMMON) &&
                    item.enterpriseId === userEnterpriseId
                );
            }
            return (
                item.refValues?.typeSection == TypeSECTION.PRODUCTION ||
                item.refValues?.typeSection == TypeSECTION.COMMON
            )
        }

        if (contentName == DocumentType.TakeProfit) {
            return (item.refValues?.typeSection == TypeSECTION.FOUNDER)
        }

        if (contentName == DocumentType.LeaveCash ) {
            if (currentDocument?.docValues?.isFounder) {
                if (item.refValues?.typeSection !== TypeSECTION.FOUNDER) return false;
                // Глобальные таъсисчилар (справочник без привязки к организации)
                if (item.enterpriseId == null) return true;
                if (user?.superKassir === true) {
                    const isOwn = user?.enterpriseId == item.enterpriseId;
                    if (isOwn) return true;
                    return item.refValues?.hasBuxgalter !== true;
                }
                return item.enterpriseId === userEnterpriseId;
            }
            if (user?.superKassir === true) {
                if (item.refValues?.typeSection !== TypeSECTION.COMMON) return false;
                const isOwn = user?.enterpriseId == item.enterpriseId;
                if (isOwn) return true;
                return item.refValues?.hasBuxgalter !== true;
            }   
            else {
                return (
                    (item.refValues?.typeSection == TypeSECTION.PRODUCTION ||
                     item.refValues?.typeSection == TypeSECTION.COMMON) &&
                    item.enterpriseId === userEnterpriseId
                );
            }
        }

        if (contentName == DocumentType.ZpCalculate) {
            if (typeReference !== TypeReference.STORAGES) return false;
            // superKassir: только COMMON — своей организации и чужих без hasBuxgalter
            if (user?.superKassir === true) {
                if (item.refValues?.typeSection !== TypeSECTION.COMMON) return false;
                const isOwn = user?.enterpriseId == item.enterpriseId;
                if (isOwn) return true;
                return item.refValues?.hasBuxgalter !== true;
            }
            // обычный пользователь: только своя организация, COMMON или PRODUCTION
            return (
                user?.enterpriseId == item.enterpriseId &&
                (   item.refValues?.typeSection == TypeSECTION.COMMON ||
                    item.refValues?.typeSection == TypeSECTION.PRODUCTION
                )
            );
        }

        if (contentName == DocumentType.MoveCash) {
            if ( user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.HEADCOMPANY ) {
                return (
                    item.refValues?.typeSection == TypeSECTION.CASH  ||
                    item.refValues?.typeSection == TypeSECTION.FOUNDER ||
                    item.refValues?.typeSection == TypeSECTION.BANK ||
                    item.refValues?.typeSection == TypeSECTION.PLASTIK
                ) 
            } else  {
                return (
                    item.refValues?.typeSection == TypeSECTION.CASH ||
                    item.refValues?.typeSection == TypeSECTION.BANK ||
                    item.refValues?.typeSection == TypeSECTION.PLASTIK
                )
            } 
        }

               
        return true
    }
    
    return false
}

