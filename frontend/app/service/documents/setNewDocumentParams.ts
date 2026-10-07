import { Maindata } from '@/app/context/app.context.interfaces';
import { DocumentType, RentTariffType } from '@/app/interfaces/document.interface';
import { defaultDocument } from '@/app/context/app.context.helpers.constants';
import { getDefinedItemIdForReceiver, getDefinedItemIdForSender } from '@/app/components/documents/document/docValues/doc.values.functions';
import { getDefaultDocumentDateMs } from '@/app/utils/dateInput';

export const setNewDocumentParams = ( setMainData: Function | undefined, mainData: Maindata ) => {
  const { user } = mainData.users;
  const { contentName } = mainData.document;
  let defValue = { ...defaultDocument }
  defValue.date = getDefaultDocumentDateMs()
  defValue.documentType = contentName as DocumentType
  // Не оставлять userId: 0 — иначе create падает на documents_userId_fkey
  defValue.userId = user?.id ? Number(user.id) : 0
  let definedItemIdForReceiver = getDefinedItemIdForReceiver(user?.role, user?.sectionId, contentName)
  let definedItemIdForSender = getDefinedItemIdForSender(
    user?.role,
    user?.sectionId,
    contentName,
    mainData.reference?.allReferences,
    user?.enterpriseId,
    user?.allowedStorageIds,
  )

  const isSubleaseTransfer = contentName === DocumentType.TransferSubleaseToolsToClient;
  const isSubleaseReceive = contentName === DocumentType.ReceiveSubleaseToolsFromClient;
  
  if (defValue.docValues) {
    // Субаренда: склад партнёра не подставляем из цеха пользователя
    if (isSubleaseTransfer) {
      defValue.docValues.senderId = 0;
      defValue.docValues.receiverId = definedItemIdForReceiver ? definedItemIdForReceiver : 0;
    } else if (isSubleaseReceive) {
      defValue.docValues.senderId = definedItemIdForSender ? definedItemIdForSender : 0;
      defValue.docValues.receiverId = 0;
    } else {
      defValue.docValues.receiverId = definedItemIdForReceiver ? definedItemIdForReceiver : 0;
      defValue.docValues.senderId = definedItemIdForSender ? definedItemIdForSender : 0;
    }

    if (contentName === DocumentType.TransferToolsToClient || isSubleaseTransfer) {
      defValue.docValues.settlementDate = getDefaultDocumentDateMs();
    }
    if (contentName === DocumentType.OrderToolsToClient && defValue.docValues) {
      defValue.docValues.rentTariffType = RentTariffType.CASH;
    }
    if (contentName === DocumentType.ReceiveToolsFromClient || isSubleaseReceive) {
      defValue.docValues.returnDateTime = getDefaultDocumentDateMs();
    }
  }

  // Не устанавливаем enterpriseId автоматически для KASSIRGLOBAL
  // Пользователь сможет выбрать организацию, если у него есть право canEditDocuments
  // Если права нет, организация будет установлена в компонентах InfoSection/ValuesSection

  setMainData && setMainData('document.isDuplicateDraft', false);
  setMainData && setMainData('currentDocument', { ...defValue });

  // Autofill PARTNER_TOOLS только в PartnersSection на форме документа —
  // иначе async ...defValue затирает userId/enterpriseId после открытия карточки.
}
