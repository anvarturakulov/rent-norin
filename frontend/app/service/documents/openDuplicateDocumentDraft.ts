import { Maindata } from '@/app/context/app.context.interfaces';
import { defaultDocument } from '@/app/context/app.context.helpers.constants';
import { DocSTATUS, DocumentModel, DocumentType, DocTableItem } from '@/app/interfaces/document.interface';
import { fetchDocumentById } from '@/app/service/documents/getDocumentById';
import { getComeProductCalculationSignature } from '@/app/service/documents/getComeProductCalculationSignature';
import { getDefaultDocumentDateMs } from '@/app/utils/dateInput';

/**
 * Открывает окно нового документа с данными копии (без сохранения в БД).
 * Для межпредприятийских документов не вызывать — проверка на стороне UI.
 */
export async function openDuplicateDocumentDraft(
  id: number | undefined,
  token: string | undefined,
  setMainData: Function | undefined,
  mainData: Maindata,
  currentContentName?: string,
  setIsDisabled?: (disabled: boolean) => void
): Promise<void> {
  if (!id || !token || !setMainData) return;

  setIsDisabled?.(true);
  try {
    const src = await fetchDocumentById(id, token);
    if (!src) {
      alert('Хужжат юкланмади');
      return;
    }
    if (src.isInterEnterprise) {
      return;
    }

    const previousContentName =
      currentContentName !== undefined ? currentContentName : mainData?.document?.contentName;

    const todayMs = getDefaultDocumentDateMs();

    const docTableItems: DocTableItem[] = (src.docTableItems || []).map((row) => {
      const copy = { ...(row as unknown as Record<string, unknown>) };
      delete copy.id;
      delete copy.docId;
      delete copy.createdAt;
      delete copy.updatedAt;
      return copy as unknown as DocTableItem;
    });

    const draft: DocumentModel = {
      ...src,
      id: defaultDocument.id,
      date: todayMs,
      docStatus: DocSTATUS.OPEN,
      isLocked: false,
      userId: mainData.users.user?.id ?? 0,
      documentType: src.documentType,
      docValues: { ...src.docValues },
      docTableItems,
      enterpriseId: src.enterpriseId ?? null,
      enterprise: undefined,
      sourceEnterprise: undefined,
      targetEnterprise: undefined,
      isInterEnterprise: undefined,
      sourceEnterpriseId: undefined,
      targetEnterpriseId: undefined,
      documentTypeForSender: undefined,
      documentTypeForReceiver: undefined,
      rejectionReason: undefined,
    };

    setMainData('clearControlElements', true);
    setMainData('showDocumentWindow', false);
    setMainData('document.previousContentName', previousContentName);
    setMainData('contentName', src.documentType);
    setMainData('document.isDuplicateDraft', true);
    setMainData('currentDocument', draft);
    setMainData('isNewDocument', true);

    if (src.documentType === DocumentType.ComeProduct) {
      setMainData(
        'document.comeProductCalculationSignature',
        getComeProductCalculationSignature(docTableItems)
      );
    } else {
      setMainData('document.comeProductCalculationSignature', null);
    }

    setMainData('showDocumentWindow', true);
  } finally {
    setIsDisabled?.(false);
  }
}
