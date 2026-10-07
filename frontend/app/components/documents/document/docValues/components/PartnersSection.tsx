'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SelectReferenceInForm } from '../../selects/selectReferenceInForm/selectReferenceInForm';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import styles from '../docValues.module.css';
import { useAppContext } from '@/app/context/app.context';
import { DocSTATUS, DocumentType } from '@/app/interfaces/document.interface';
import { RentalContractBasisInfo } from './rentalContractBasisInfo/rentalContractBasisInfo';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { validateIndividualClientForTools } from '../../selects/selectReferenceInForm/utils/validateIndividualClientForTools';
import IndividualClientWarningModal from './individualClientWarningModal/individualClientWarningModal';
import {
  findDefaultSubleasePartnerStorage,
  pickDefaultSubleasePartnerStorage,
  SUBLEASE_STORAGE_MISSING_MSG,
} from '@/app/service/documents/autoFillSubleasePartner';
import { showMessage } from '@/app/service/common/showMessage';
import {
  getLabelForReceiver,
  getTypeReferenceForReceiver,
} from '../doc.values.functions';

interface PartnersSectionProps {
  options: any;
  currentValues: {
    receiverId: number | undefined;
    senderId: number | undefined;
  };
  definedIds: {
    receiver: number | undefined;
    sender: number | undefined;
  };
}

const PartnersSection = memo<PartnersSectionProps>(({
  options,
  currentValues,
  definedIds
}) => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument, contentName } = mainData.document;
  const user = mainData.users.user;
  const token = user?.token;
  const { data: references } = useAllReferences(token);
  const isDepartment = currentDocument?.docValues?.isDepartment;
  const subleaseAutofillDoneRef = useRef<string | null>(null);

  const isTransfer = contentName === DocumentType.TransferToolsToClient ||
    contentName === DocumentType.OrderToolsToClient ||
    contentName === DocumentType.TransferSubleaseToolsToClient;
  const isReceive = contentName === DocumentType.ReceiveToolsFromClient ||
    contentName === DocumentType.ReceiveSubleaseToolsFromClient;
  const isToolsDoc = isTransfer || isReceive;
  const isSubleaseTransfer = contentName === DocumentType.TransferSubleaseToolsToClient;
  const isSublease = isSubleaseTransfer ||
    contentName === DocumentType.ReceiveSubleaseToolsFromClient;

  const clientId = isToolsDoc
    ? (isTransfer
        ? Number(currentValues.receiverId) || 0
        : Number(currentValues.senderId) || 0)
    : 0;

  const [warningErrors, setWarningErrors] = useState<string[]>([]);
  const [warningPartnerName, setWarningPartnerName] = useState('');
  const lastCheckedClientIdRef = useRef<number | null>(null);

  const closeWarning = useCallback(() => {
    setWarningErrors([]);
    setWarningPartnerName('');
  }, []);

  // Основной склад (SaleTovar/LeaveTovar): definedIds.sender рисует поле, но не пишет senderId
  useEffect(() => {
    if (!setMainData || !currentDocument?.docValues) return;
    if (currentDocument.docStatus && currentDocument.docStatus !== DocSTATUS.OPEN) return;

    const definedSenderId = Number(definedIds.sender) || 0;
    const currentSenderId = Number(currentDocument.docValues.senderId) || 0;
    if (definedSenderId <= 0 || currentSenderId > 0) return;

    setMainData('currentDocument', {
      ...currentDocument,
      docValues: {
        ...currentDocument.docValues,
        senderId: definedSenderId,
      },
    });
  }, [definedIds.sender, currentDocument, setMainData]);

  // Автовыбор единственного PARTNER_TOOLS + partnerId для документов субаренды
  useEffect(() => {
    if (!isSublease || !currentDocument?.docValues || !setMainData) return;

    const partnerId = Number(currentDocument.docValues.partnerId) || 0;
    const storageId = isSubleaseTransfer
      ? Number(currentDocument.docValues.senderId) || 0
      : Number(currentDocument.docValues.receiverId) || 0;

    if (partnerId > 0 && storageId > 0) {
      subleaseAutofillDoneRef.current = `${currentDocument.id ?? 'new'}:ok`;
      return;
    }

    const enterpriseId =
      currentDocument.enterpriseId ??
      mainData.reference?.selectedEnterpriseId ??
      user?.enterpriseId ??
      null;

    const attemptKey = `${currentDocument.id ?? 'new'}:${enterpriseId ?? 0}`;
    if (subleaseAutofillDoneRef.current === attemptKey) return;

    let cancelled = false;

    const applyFound = (found: { partnerId: number; storageId: number }) => {
      if (cancelled || !currentDocument.docValues) return;
      subleaseAutofillDoneRef.current = attemptKey;
      const sessionUserId = Number(user?.id) || Number(currentDocument.userId) || 0;
      setMainData('currentDocument', {
        ...currentDocument,
        ...(sessionUserId > 0 ? { userId: sessionUserId } : {}),
        docValues: {
          ...currentDocument.docValues,
          partnerId: found.partnerId,
          ...(isSubleaseTransfer
            ? { senderId: found.storageId }
            : { receiverId: found.storageId }),
        },
      });
    };

    const fromCache = pickDefaultSubleasePartnerStorage(references, enterpriseId);
    if (fromCache) {
      applyFound(fromCache);
      return () => {
        cancelled = true;
      };
    }

    if (!token || enterpriseId == null || Number(enterpriseId) <= 0) {
      // enterprise ещё не готов — не помечаем attempt как done, повторим позже
      return;
    }

    void (async () => {
      const found = await findDefaultSubleasePartnerStorage(token, enterpriseId);
      if (cancelled) return;
      if (found) {
        applyFound(found);
        return;
      }
      // Только после реального запроса STORAGES с известным enterpriseId
      subleaseAutofillDoneRef.current = attemptKey;
      showMessage(SUBLEASE_STORAGE_MISSING_MSG, 'error', setMainData);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isSublease,
    isSubleaseTransfer,
    currentDocument,
    references,
    token,
    user?.enterpriseId,
    mainData.reference?.selectedEnterpriseId,
    setMainData,
  ]);

  useEffect(() => {
    if (!isToolsDoc) {
      lastCheckedClientIdRef.current = null;
      return;
    }

    if (clientId <= 0) {
      lastCheckedClientIdRef.current = null;
      setWarningErrors([]);
      setWarningPartnerName('');
      return;
    }

    if (lastCheckedClientIdRef.current === clientId) return;
    if (!references?.length) return;

    const partner = references.find((item: ReferenceModel) => item.id === clientId);
    if (!partner) return;

    lastCheckedClientIdRef.current = clientId;
    let cancelled = false;
    const asOf = Number(currentDocument?.date) || Date.now();

    (async () => {
      const errors = await validateIndividualClientForTools(partner, token, asOf);
      if (cancelled) return;
      if (errors.length > 0) {
        setWarningPartnerName(partner.name || '');
        setWarningErrors(errors);
      } else {
        setWarningErrors([]);
        setWarningPartnerName('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isToolsDoc,
    clientId,
    references,
    token,
    currentDocument?.date,
  ]);

  const isSaleMaterial = contentName === DocumentType.SaleMaterial;
  const receiverType =
    isSaleMaterial && currentDocument
      ? getTypeReferenceForReceiver(currentDocument, options)
      : isDepartment
        ? TypeReference.STORAGES
        : options.receiverType;
  const receiverLabel =
    isSaleMaterial && currentDocument
      ? getLabelForReceiver(currentDocument, options)
      : options.receiverLabel;
  const senderType = isDepartment ? TypeReference.STORAGES : options.senderType;
  const saleMaterialReceiverKey = isSaleMaterial
    ? currentDocument?.docValues?.isPartner
      ? 'supplier'
      : currentDocument?.docValues?.isWorker
        ? 'worker'
        : 'client'
    : '';

  return (
    <div className={styles.partnersBox}>
      
      <SelectReferenceInForm
        key={`sender-${senderType}`}
        label={options.senderLabel} 
        typeReference={senderType}
        visibile={options.senderIsVisible}
        currentItemId={currentValues.senderId}
        type='sender'
        definedItemId={definedIds.sender}
      />
      
      <SelectReferenceInForm
        key={`receiver-${receiverType}${saleMaterialReceiverKey ? `-${saleMaterialReceiverKey}` : ''}`}
        label={receiverLabel} 
        typeReference={receiverType}
        visibile={options.recieverIsVisible}
        currentItemId={currentValues.receiverId}
        type='receiver'
        definedItemId={definedIds.receiver}
      />

      <RentalContractBasisInfo />

      {warningErrors.length > 0 ? (
        <IndividualClientWarningModal
          partnerName={warningPartnerName}
          errors={warningErrors}
          onClose={closeWarning}
        />
      ) : null}
    </div>
  );
});

PartnersSection.displayName = 'PartnersSection';

export default PartnersSection;
