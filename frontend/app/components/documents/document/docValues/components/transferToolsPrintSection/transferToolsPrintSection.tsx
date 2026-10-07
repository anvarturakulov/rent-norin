'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useReactToPrint } from 'react-to-print';
import { DocumentModel } from '@/app/interfaces/document.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { useAppContext } from '@/app/context/app.context';
import { rentalContractsApi } from '@/app/service/rentalContracts/rentalContracts.service';
import { formatRentalContractBasisUz } from '@/app/interfaces/rentalContract.interface';
import TransferToolsPrintDocument from '../../../transferToolsPrintDocument/transferToolsPrintDocument';
import {
  askPrintCopyCount,
  DEFAULT_PRINT_COPIES,
} from '../../../printCopies/printCopies';

export const useTransferToolsPrint = () => {
  const printRef = useRef<HTMLDivElement>(null);
  const { mainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const token = mainData.users.user?.token;
  const { data: references } = useAllReferences(token);

  const clientId = Number(currentDocument?.docValues?.receiverId) || 0;
  const asOf = Number(currentDocument?.date) || Date.now();

  const { data: activeContract, mutate } = useSWR(
    token && clientId > 0 ? ['rental-contract-active', clientId, asOf] : null,
    () => rentalContractsApi.getActiveByClient(token!, clientId, asOf),
  );

  const [printBasisOverride, setPrintBasisOverride] = useState<string | null>(null);
  const [copyCount, setCopyCount] = useState(DEFAULT_PRINT_COPIES);
  const [shouldPrint, setShouldPrint] = useState(false);

  const contractBasis =
    printBasisOverride ?? formatRentalContractBasisUz(activeContract);

  const toolNames = useMemo(() => {
    const map: Record<number, string> = {};
    (references || []).forEach((ref: ReferenceModel) => {
      if (ref.id == null) return;
      map[ref.id] = ref.name;
    });
    return map;
  }, [references]);

  const clientName = references?.find(
    (r: ReferenceModel) => r.id === currentDocument?.docValues?.receiverId,
  )?.name;

  const printFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ускуналарни топшириш кабул килиш далолатномаси ${currentDocument?.id ?? ''}`,
  });

  useEffect(() => {
    if (!shouldPrint) return;
    setShouldPrint(false);
    printFn();
  }, [shouldPrint, contractBasis, copyCount, printFn]);

  const handlePrint = useCallback(async () => {
    const n = askPrintCopyCount();
    if (n == null) return;

    setCopyCount(n);

    if (token && clientId > 0) {
      const fresh = await mutate();
      setPrintBasisOverride(formatRentalContractBasisUz(fresh));
    } else {
      setPrintBasisOverride('');
    }
    setShouldPrint(true);
  }, [token, clientId, mutate]);

  const PrintContent = currentDocument ? (
    <div style={{ display: 'none' }}>
      <TransferToolsPrintDocument
        ref={printRef}
        document={currentDocument as DocumentModel}
        clientName={clientName}
        contractBasis={contractBasis}
        toolNames={toolNames}
        copyCount={copyCount}
      />
    </div>
  ) : null;

  return { handlePrint, PrintContent };
};
