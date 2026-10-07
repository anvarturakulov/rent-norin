import { DocumentModel, DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { getNameReference, isFounder, getTypeSectionByReferenceId, getIsForeignByReferenceId } from './helpers/journal.functions';
import { UserRoles } from '@/app/interfaces/user.interface';
import { TypeSECTION } from '@/app/interfaces/reference.interface';

type TabType = 'CASH' | 'BANK' | 'USD' | 'PLASTIK';

export function filterDocuments(
  documents: DocumentModel[],
  journalChechboxs: any,
  references: any,
  mainData: any,
  role: string,
  contentName: string,
  activeTab: TabType = 'CASH'
) {
  // Фильтрация по userId для KASSIR и GLAVBUX только для определенных типов документов
  let filteredDocs = documents;
  const userId = mainData?.users?.user?.id;
  const currentUserEnterpriseId = mainData?.users?.user?.enterpriseId;
  const cashDocumentTypes = [
    DocumentType.LeaveCash,
    DocumentType.ComeCashFromClients
  ];
  
  if (
    userId && 
    (role === UserRoles.KASSIR || role === UserRoles.GLAVBUX) &&
    cashDocumentTypes.includes(contentName as DocumentType)
  ) {
    filteredDocs = documents.filter((doc) => {
      const isReceiver =
        !!currentUserEnterpriseId &&
        doc.isInterEnterprise &&
        doc.targetEnterpriseId === currentUserEnterpriseId;

      // Получатель межорганизационного документа должен видеть документ,
      // даже если userId принадлежит отправителю
      return isReceiver || doc.userId === userId;
    });
  }

  // Исключаем межорганизационные LeaveCash документы из журнала организации-получателя
  if (contentName === DocumentType.LeaveCash) {
    filteredDocs = filteredDocs.filter((doc) => {
      const isReceiver = 
        !!currentUserEnterpriseId &&
        doc.isInterEnterprise &&
        doc.targetEnterpriseId === currentUserEnterpriseId;
      
      // Не показываем документ, если текущий пользователь является получателем
      return !isReceiver;
    });
  }

  // Фильтрация по галочке "Тасдиклаш учун"
  if (journalChechboxs.pendingApproval) {
    filteredDocs = filteredDocs.filter((item) => {
      return item.docStatus === DocSTATUS.PENDING;
    });
  }

  // Фильтрация по TypeSECTION и isForeign для leaveCash, MoveCash, ComeCashFromClients
  if (
    contentName === DocumentType.LeaveCash || 
    contentName === DocumentType.MoveCash || 
    contentName === DocumentType.ComeCashFromClients ||
    contentName === DocumentType.Advance
  ) {
    filteredDocs = filteredDocs.filter((item) => {
      const userEnterpriseId = mainData?.users?.user?.enterpriseId;
      const isInterEnterprise = item.isInterEnterprise;
      const isReceiver = isInterEnterprise && item.targetEnterpriseId === userEnterpriseId;
      
      // Для межпредпр. LeaveCash у получателя не применяем таб-фильтр,
      // так как receiverId - это COMMON storage (не имеет типа CASH/BANK)
      if (contentName === DocumentType.LeaveCash && isReceiver) {
        return true; // Показываем документ на всех вкладках
      }
      
      let referenceId: number | undefined;
      
      // Для leaveCash и MoveCash фильтруем по senderId
      if (contentName === DocumentType.LeaveCash || contentName === DocumentType.MoveCash || contentName === DocumentType.Advance) {
        referenceId = item.docValues?.senderId;
      }
      // Для ComeCashFromClients фильтруем по receiverId
      else if (contentName === DocumentType.ComeCashFromClients) {
        referenceId = item.docValues?.receiverId;
      }
      
      const typeSection = getTypeSectionByReferenceId(references, referenceId);
      const isForeign = getIsForeignByReferenceId(references, referenceId);
      
      // Для вкладки "Банк" проверяем только TypeSECTION.BANK
      if (activeTab === 'BANK') {
        return typeSection === TypeSECTION.BANK;
      }

      if (activeTab === 'PLASTIK') {
        return typeSection === TypeSECTION.PLASTIK;
      }
      
      // Для вкладок "Накд" и "USD" проверяем TypeSECTION.CASH и isForeign
      if (activeTab === 'CASH') {
        // Накд: TypeSECTION.CASH && (isForeign === false || isForeign === null || isForeign === undefined)
        return typeSection === TypeSECTION.CASH && (isForeign === false || isForeign === null);
      }
      
      if (activeTab === 'USD') {
        // USD: TypeSECTION.CASH && isForeign === true
        return typeSection === TypeSECTION.CASH && isForeign === true;
      }
      
      return false;
    });
  }

  return filteredDocs
    .sort((a, b) => {
      const dateComparison = a.date - b.date;
      if (dateComparison === 0 && a.id && b.id && a.documentType !== DocumentType.ZpCalculate) {
        return a.id - b.id;
      }

      if (dateComparison === 0 && a.docValues.analiticId && b.docValues.analiticId) {
        const aName = getNameReference(references, a.docValues.analiticId);
        const bName = getNameReference(references, b.docValues.analiticId);
        return aName.localeCompare(bName);
      }

      return dateComparison;
    })
    .filter((item) => {
      if (journalChechboxs.charges && contentName == DocumentType.LeaveCash && (item.docValues?.isWorker || item.docValues?.isMediator || item.docValues?.isDeliverer || item.docValues?.isPartner || item.docValues?.isClient || item.docValues?.isFounder || isFounder(references, item.docValues?.senderId) || item.docValues?.isDepartment)) return false;
      if (journalChechboxs.workers && !item.docValues?.isWorker) return false;
      if (journalChechboxs.mediators && !item.docValues?.isMediator) return false;
      if (journalChechboxs.deliverers && !item.docValues?.isDeliverer) return false;
      if (journalChechboxs.partners && !item.docValues?.isPartner) return false;
      if (journalChechboxs.clients && !item.docValues?.isClient) return false;
      if (journalChechboxs.departments && !item.docValues?.isDepartment) return false;
      return true;
    });
}

export function getTotals(filteredDocuments: DocumentModel[], totalsFn: (item: DocumentModel) => { t: number, c: number, cost: number }) {
  let total = 0, count = 0, docCount = 0, totalSecond = 0, totalCost = 0;
  filteredDocuments.forEach((item) => {
    if (item.docStatus !== DocSTATUS.DELETED) {
      const { t, c, cost } = totalsFn(item);
      total += t;
      count += c;
      docCount += 1;
      totalCost += cost;
      }
  });
  return { total, count, docCount, totalSecond, totalCost };
} 