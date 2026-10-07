import { useMemo } from 'react';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';
import { ReferenceModel, TypeReference, TypeTMZ, TypePartners, TypeSECTION } from '@/app/interfaces/reference.interface';
import { DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { getTypeDocumentForReference } from '@/app/service/documents/getTypeDocumentForReference';
import { FILTER_CONDITIONS, TYPE_TMZ_MAPPING } from '../constants/select.constants';
import { reciever } from '../query/reciever';
import { sender } from '../query/sender';
import { analitic } from '../query/analitic';
import { productForCharge } from '../query/productForCharge';
import { senderPerson } from '../query/senderPerson';
import { car } from '../query/car';
import { materialResponsiblePerson } from '../query/materialResponsiblePerson';
import { mediator } from '../query/mediator';
import { deliverer } from '../query/deliverer';
import { shouldSkipOrgFilterInReportSelect } from '@/app/components/reference/helpers/reference.constants';
interface UseSelectReferenceDataProps {
  typeReference: TypeReference;
  type: string;
  contentName: string;
  mainData: any;
  token: string | undefined;
}

export const useSelectReferenceData = ({
  typeReference,
  type,
  contentName,
  mainData,
  token
}: UseSelectReferenceDataProps) => {
  // Для межпредприятийных документов нужно также загружать справочники отправителя
  const currentDocument = mainData?.document?.currentDocument;
  const isInterEnterprise = currentDocument?.isInterEnterprise;
  const sourceEnterpriseId = isInterEnterprise ? currentDocument?.sourceEnterpriseId : null;
  const userEnterpriseId = mainData?.users?.user?.enterpriseId;
  const isReceiver = isInterEnterprise && currentDocument?.targetEnterpriseId === userEnterpriseId;
  
  // Для ComeCashFromClients: если выбран analiticId (вторая организация), загружаем клиентов этой организации
  const analiticId = currentDocument?.docValues?.analiticId;
  // Для LeaveCash и ComeMaterial: если выбран receiverId (COMMON storage), получаем enterpriseId организации-получателя
  const receiverId = currentDocument?.docValues?.receiverId;
  
  // Логирование только для ComeCashFromClients
  if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS) {
    console.log('[useSelectReferenceData] ComeCashFromClients check:', {
      contentName,
      type,
      typeReference,
      analiticId,
      token: !!token
    });
  }
  
  // Загружаем справочник analiticId для ComeCashFromClients (enterpriseId второй организации)
  const analiticReferenceUrl = (contentName === DocumentType.ComeCashFromClients && 
                                 type === 'sender' && 
                                 typeReference === TypeReference.PARTNERS && 
                                 analiticId && 
                                 analiticId > 0 && 
                                 token) 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${analiticId}` 
    : null;
  
  // Загружаем справочник receiverId для LeaveCash (enterpriseId организации-получателя)
  const receiverReferenceUrlForLeaveCash = (contentName === DocumentType.LeaveCash && 
                                 receiverId && 
                                 receiverId > 0 && 
                                 token) 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${receiverId}` 
    : null;
  
  // Загружаем справочник receiverId для ComeMaterial (для sender PARTNERS)
  const receiverReferenceUrlForComeMaterial = ((contentName === DocumentType.ComeMaterial || contentName === DocumentType.ComeTools || contentName === DocumentType.ComeTovar || contentName === DocumentType.ComeOS) &&
                                 type === 'sender' && 
                                 typeReference === TypeReference.PARTNERS && 
                                 receiverId && 
                                 receiverId > 0 && 
                                 token) 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${receiverId}` 
    : null;
  
  // Загружаем справочник receiverId для ZpCalculate (analitic WORKERS — сотрудники выбранной организации)
  const receiverReferenceUrlForZpCalculate = (contentName === DocumentType.ZpCalculate && 
                                 receiverId && 
                                 receiverId > 0 && 
                                 token) 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${receiverId}` 
    : null;
  
  // Логирование только для отладки
  if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS) {
    console.log('[useSelectReferenceData] analiticReferenceUrl:', analiticReferenceUrl);
  }
  if (contentName === DocumentType.LeaveCash && type === 'analitic') {
    console.log('[useSelectReferenceData] receiverReferenceUrlForLeaveCash:', receiverReferenceUrlForLeaveCash);
  }
  if (contentName === DocumentType.ComeMaterial && type === 'sender' && typeReference === TypeReference.PARTNERS) {
    console.log('[useSelectReferenceData] receiverReferenceUrlForComeMaterial:', receiverReferenceUrlForComeMaterial);
  }
  
  const { data: analiticReference } = useSWR(
    analiticReferenceUrl,
    (url) => getDataForSwr(url, token)
  );
  
  const { data: receiverReference } = useSWR(
    receiverReferenceUrlForLeaveCash,
    (url) => getDataForSwr(url, token)
  );
  
  const { data: receiverReferenceForComeMaterial } = useSWR(
    receiverReferenceUrlForComeMaterial,
    (url) => getDataForSwr(url, token)
  );
  
  const { data: receiverReferenceForZpCalculate } = useSWR(
    receiverReferenceUrlForZpCalculate,
    (url) => getDataForSwr(url, token)
  );
  
  // Логирование только для ComeCashFromClients
  if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS && analiticReference) {
    console.log('[useSelectReferenceData] analiticReference loaded:', {
      analiticReference: {
        id: analiticReference.id,
        name: analiticReference.name,
        enterpriseId: analiticReference.enterpriseId,
        typeSection: analiticReference?.refValues?.typeSection,
      },
      analiticId: analiticId
    });
  }
  
  const targetEnterpriseIdForClients = useMemo(() => {
    if (analiticReference?.enterpriseId && analiticReference.enterpriseId !== userEnterpriseId) {
      return analiticReference.enterpriseId;
    }
    return null;
  }, [analiticReference, userEnterpriseId]);
  
  const targetEnterpriseIdForLeaveCash = useMemo(() => {
    if (contentName !== DocumentType.LeaveCash) return null;
    return receiverReference?.enterpriseId ?? null;
  }, [receiverReference, contentName]);
  
  const targetEnterpriseIdForComeMaterial = useMemo(() => {
    if ((contentName !== DocumentType.ComeMaterial && contentName !== DocumentType.ComeTools && contentName !== DocumentType.ComeTovar && contentName !== DocumentType.ComeOS) || type !== 'sender' || typeReference !== TypeReference.PARTNERS) return null;
    return receiverReferenceForComeMaterial?.enterpriseId ?? null;
  }, [receiverReferenceForComeMaterial, contentName, type, typeReference]);
  
  const targetEnterpriseIdForZpCalculate = useMemo(() => {
    if (contentName !== DocumentType.ZpCalculate) return null;
    return receiverReferenceForZpCalculate?.enterpriseId ?? null;
  }, [contentName, receiverReferenceForZpCalculate]);

  const effectivePartnerType = useMemo(() => {
    if (typeReference !== TypeReference.PARTNERS) return undefined;
    if (contentName === DocumentType.ComeCashFromClients && type === 'sender') return 'CLIENTS';
    if (contentName === DocumentType.TransferToolsToClient && type === 'receiver') return 'CLIENTS';
    if (contentName === DocumentType.OrderToolsToClient && type === 'receiver') return 'CLIENTS';
    if (contentName === DocumentType.TransferSubleaseToolsToClient && type === 'receiver') return 'CLIENTS';
    if (contentName === DocumentType.ReceiveToolsFromClient && type === 'sender') return 'CLIENTS';
    if (contentName === DocumentType.ReceiveSubleaseToolsFromClient && type === 'sender') return 'CLIENTS';
    if ((contentName === DocumentType.ComeMaterial || contentName === DocumentType.ComeTools || contentName === DocumentType.ComeTovar || contentName === DocumentType.ComeOS) && type === 'sender') {
      return 'SUPPLIERS';
    }
    if (contentName === DocumentType.LeaveCash && type === 'analitic') {
      if (currentDocument?.docValues?.isDepartment) return 'DEPARTMENTS';
      if (currentDocument?.docValues?.isClient) return 'CLIENTS';
      return 'SUPPLIERS';
    }
    if (contentName === DocumentType.SaleMaterial && type === 'receiver') {
      if (currentDocument?.docValues?.isPartner) return 'SUPPLIERS';
      return 'CLIENTS';
    }
    return undefined;
  }, [typeReference, contentName, type, currentDocument?.docValues?.isDepartment, currentDocument?.docValues?.isClient, currentDocument?.docValues?.isPartner]);

  const skipOrgFilter = shouldSkipOrgFilterInReportSelect(typeReference, effectivePartnerType);
  
  // Формируем URL с учетом analiticId для загрузки клиентов нужной организации
  const url = useMemo(() => {
    console.log('[useSelectReferenceData] 🔗 Building URL with params:', {
      contentName,
      type,
      typeReference,
      targetEnterpriseIdForClients,
      userEnterpriseId,
      analiticId
    });
    
    const urlParams = new URLSearchParams();
    
    // Если пользователь - получатель межпредприятийного документа, передаем sourceEnterpriseId
    if (isReceiver && sourceEnterpriseId && sourceEnterpriseId !== userEnterpriseId) {
      urlParams.append('sourceEnterpriseId', sourceEnterpriseId.toString());
    }
    
    // Для ComeCashFromClients в sender (PARTNERS) управляем загрузкой клиентов
    if (!skipOrgFilter &&
        contentName === DocumentType.ComeCashFromClients && 
        type === 'sender' && 
        typeReference === TypeReference.PARTNERS) {
      if (targetEnterpriseIdForClients) {
        // Если выбран analiticId, загружаем клиентов второй организации
        urlParams.set('enterpriseId', targetEnterpriseIdForClients.toString());
        console.log('[useSelectReferenceData] ✅ Loading clients for SECOND organization:', targetEnterpriseIdForClients);
      } else if (userEnterpriseId !== null && userEnterpriseId !== undefined) {
        // Если analiticId не выбран, загружаем клиентов своей организации
        urlParams.set('enterpriseId', userEnterpriseId.toString());
        console.log('[useSelectReferenceData] ✅ Loading clients for OWN organization:', userEnterpriseId);
      } else {
        console.log('[useSelectReferenceData] ⚠️ No enterpriseId set - will load all clients');
      }
    }
    
    // Для LeaveCash в analitic управляем загрузкой справочников организации-получателя
    if (!skipOrgFilter &&
        contentName === DocumentType.LeaveCash && 
        type === 'analitic' && 
        targetEnterpriseIdForLeaveCash) {
      // Загружаем справочники организации-получателя (PARTNERS, WORKERS, CHARGES)
      if (typeReference === TypeReference.PARTNERS || 
          typeReference === TypeReference.WORKERS || 
          typeReference === TypeReference.CHARGES) {
        urlParams.set('enterpriseId', targetEnterpriseIdForLeaveCash.toString());
        console.log('[useSelectReferenceData] ✅ Loading', typeReference, 'for RECEIVER organization:', targetEnterpriseIdForLeaveCash);
      }
    }
    
    // Для ComeMaterial/ComeOS в sender (PARTNERS) управляем загрузкой поставщиков организации-получателя
    if (!skipOrgFilter &&
        (contentName === DocumentType.ComeMaterial || contentName === DocumentType.ComeTools || contentName === DocumentType.ComeTovar || contentName === DocumentType.ComeOS) &&
        type === 'sender' && 
        typeReference === TypeReference.PARTNERS) {
      if (targetEnterpriseIdForComeMaterial) {
        // Если выбран receiverId (склад другого предприятия), загружаем поставщиков организации-получателя
        urlParams.set('enterpriseId', targetEnterpriseIdForComeMaterial.toString());
        console.log('[useSelectReferenceData] ✅ Loading suppliers for RECEIVER organization:', targetEnterpriseIdForComeMaterial);
      } else if (userEnterpriseId !== null && userEnterpriseId !== undefined) {
        // Если receiverId не выбран или не межпредприятийный, загружаем поставщиков своей организации
        urlParams.set('enterpriseId', userEnterpriseId.toString());
        console.log('[useSelectReferenceData] ✅ Loading suppliers for OWN organization:', userEnterpriseId);
      } else {
        console.log('[useSelectReferenceData] ⚠️ No enterpriseId set - will load all suppliers');
      }
    }
    
    // Для ZpCalculate в analitic (WORKERS) загружаем сотрудников организации выбранного получателя
    if (!skipOrgFilter &&
        contentName === DocumentType.ZpCalculate && 
        type === 'analitic' && 
        typeReference === TypeReference.WORKERS) {
      if (targetEnterpriseIdForZpCalculate != null) {
        urlParams.set('enterpriseId', targetEnterpriseIdForZpCalculate.toString());
      } else if (userEnterpriseId !== null && userEnterpriseId !== undefined) {
        urlParams.set('enterpriseId', userEnterpriseId.toString());
      }
    }
    
    const finalUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    console.log('[useSelectReferenceData] 🔗 Final URL:', finalUrl);
    return finalUrl;
  }, [typeReference, isReceiver, sourceEnterpriseId, userEnterpriseId, contentName, type, targetEnterpriseIdForClients, targetEnterpriseIdForLeaveCash, targetEnterpriseIdForComeMaterial, targetEnterpriseIdForZpCalculate, analiticId, receiverId, skipOrgFilter, effectivePartnerType]);
  
  const { data, error, isLoading } = useSWR(url, (url) => getDataForSwr(url, token));
  
  // Логируем загруженные данные
  if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS && data) {
    const allClients = data.filter((item: ReferenceModel) => item.refValues?.typePartners === TypePartners.CLIENTS);
    console.log('[useSelectReferenceData] 📦 Loaded clients data:', {
      url,
      dataLength: data.length,
      clientsCount: allClients.length,
      firstFewClients: data.slice(0, 10).map((item: ReferenceModel) => ({
        id: item.id,
        name: item.name,
        enterpriseId: item.enterpriseId,
        typePartners: item.refValues?.typePartners,
      })),
      targetEnterpriseIdForClients,
      userEnterpriseId,
      clientsWithExpectedEnterprise: allClients.filter((item: ReferenceModel) => 
        item.enterpriseId === (targetEnterpriseIdForClients || userEnterpriseId)
      ).length
    });
  }

  // Для MoveCash receiver: показываем кассы своей и других организаций (когда receiverId пустой)
  const isMoveCashReceiver = contentName === DocumentType.MoveCash && 
                             type === 'receiver' && 
                             typeReference === TypeReference.STORAGES && 
                             (!receiverId || receiverId === 0);
  
  const activeTab = mainData?.journal?.activeTab || 'CASH';
  const isOpenStatus = currentDocument?.docStatus === DocSTATUS.OPEN;

  // Мемоизируем фильтрованные и отсортированные данные
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      console.log('[useSelectReferenceData] No data loaded');
      return [];
    }

    // Логирование только для MoveCash receiver STORAGES
    if (isMoveCashReceiver && typeReference === TypeReference.STORAGES) {
      console.log('[useSelectReferenceData] MoveCash receiver STORAGES data loaded:', {
        typeReference,
        type,
        contentName,
        dataLength: data.length,
        receiverId,
        isOpenStatus,
        activeTab,
        userEnterpriseId
      });
    }

    const typeDocumentForReference = getTypeDocumentForReference(contentName);

    const afterTMZFilter = data
      .filter((item: ReferenceModel) => item.typeReference === typeReference)
      .filter((item: ReferenceModel) => {
        // Фильтр по типу TMZ
        if (typeReference === TypeReference.TMZ && type !== 'productForCharge') {
          switch (typeDocumentForReference) {
            case 'MATERIAL':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.MATERIAL;
            case 'PRODUCT':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.PRODUCT;
            case 'HALFSTUFF':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.HALFSTUFF;
            case 'OS':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.OS;
            case 'TOOLS':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.TOOLS;
            case 'TOVAR':
              return item.refValues?.typeTMZ === TYPE_TMZ_MAPPING.TOVAR;
            case 'OTHER':
              return true;
            default:
              return true;
          }
        }
        return true;
      });
    
    // Логирование для MoveCash receiver
    if (isMoveCashReceiver && typeReference === TypeReference.STORAGES) {
      console.log('[useSelectReferenceData] MoveCash receiver filter active', {
        isMoveCashReceiver,
        typeReference,
        type,
        contentName,
        receiverId,
        isOpenStatus,
        activeTab,
        userEnterpriseId,
        dataLength: afterTMZFilter.length
      });
    }
    
    const filtered = afterTMZFilter
      .filter((item: ReferenceModel) => {
        // Фильтр по типу селекта
        // Если статус не OPEN, query функции возвращают false, но мы должны показывать все элементы
        // для отображения текущего значения, но список опций будет пустым (disabled)
        
        // Если статус не OPEN, пропускаем все элементы (чтобы показать текущее значение)
        if (!isOpenStatus) {
          return true;
        }
        
        // Специальная фильтрация для MoveCash receiver (когда receiverId пустой)
        if (isMoveCashReceiver) {
          const itemEnterpriseId = item.enterpriseId;
          const itemTypeSection = item.refValues?.typeSection;
          const isCashSection =
            itemTypeSection === TypeSECTION.CASH ||
            itemTypeSection === TypeSECTION.BANK ||
            itemTypeSection === TypeSECTION.PLASTIK;
          const isOwnReference = itemEnterpriseId != null && itemEnterpriseId === userEnterpriseId;

          // Кассы своей организации
          if (isOwnReference && isCashSection) {
            return true;
          }

          // Кассы другой организации — показываем всегда (независимо от hasBuxgalter)
          if (isCashSection && !isOwnReference && itemEnterpriseId != null) {
            return true;
          }

          return false;
        }
        
        // Для MoveCash receiver не используем стандартную функцию reciever, так как у нас своя логика выше
        const result = (
          (contentName === DocumentType.MoveCash && type === 'receiver' && typeReference === TypeReference.STORAGES) ? false :
          (reciever(item, type, contentName, typeReference, mainData) ||
          sender(item, type, contentName, typeReference, mainData) ||
          analitic(item, type, contentName, typeReference, mainData) ||
          productForCharge(item, type, contentName, typeReference, mainData) ||
          senderPerson(item, type, contentName, typeReference, mainData) ||
          car(item, type, contentName, typeReference, mainData) ||
          materialResponsiblePerson(item, type, contentName, typeReference, mainData) ||
          mediator(item, type, contentName, typeReference, mainData) ||
          deliverer(item, type, contentName, typeReference, mainData))
        );
        
        if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS) {
          console.log('[useSelectReferenceData] Filtering item:', {
            itemId: item.id,
            itemName: item.name,
            passed: result,
            typePartners: item.refValues?.typePartners
          });
        }
        
        return result;
      })
      .sort(sortByName)
      .filter(FILTER_CONDITIONS.NOT_DELETED);

    if (contentName === DocumentType.ComeCashFromClients && type === 'sender' && typeReference === TypeReference.PARTNERS) {
      console.log('[useSelectReferenceData] Final filtered clients:', {
        totalFiltered: filtered.length,
        clients: filtered.map((item: ReferenceModel) => ({
          id: item.id,
          name: item.name,
          enterpriseId: item.enterpriseId,
        }))
      });
    }

    return filtered;
  }, [data, typeReference, type, contentName, mainData, analiticReference, receiverReference, activeTab, isMoveCashReceiver, userEnterpriseId, currentDocument]);

  return {
    data: filteredData,
    rawData: data,
    error,
    isLoading,
    isEmpty: !filteredData || filteredData.length === 0
  };
}; 