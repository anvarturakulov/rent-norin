'use client';

import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import {
  formatRentalContractBasis,
  formatRentalContractBasisUz,
} from '@/app/interfaces/rentalContract.interface';
import { rentalContractsApi } from '@/app/service/rentalContracts/rentalContracts.service';
import styles from './rentalContractBasisInfo.module.css';

export const RentalContractBasisInfo = (): JSX.Element | null => {
  const { mainData } = useAppContext();
  const { currentDocument, contentName } = mainData.document;
  const token = mainData.users.user?.token;

  const isTransfer = contentName === DocumentType.TransferToolsToClient
    || contentName === DocumentType.OrderToolsToClient;
  const isReceive = contentName === DocumentType.ReceiveToolsFromClient;
  if (!isTransfer && !isReceive) return null;

  const clientId = isTransfer
    ? Number(currentDocument?.docValues?.receiverId) || 0
    : Number(currentDocument?.docValues?.senderId) || 0;
  const asOf = Number(currentDocument?.date) || Date.now();

  const { data: activeContract, isLoading } = useSWR(
    token && clientId > 0 ? ['rental-contract-active', clientId, asOf] : null,
    () => rentalContractsApi.getActiveByClient(token!, clientId, asOf),
  );

  const basis = isTransfer
    ? formatRentalContractBasisUz(activeContract)
    : formatRentalContractBasis(activeContract);

  let text = '—';
  if (clientId <= 0) {
    text = '—';
  } else if (isLoading && activeContract === undefined) {
    text = '…';
  } else if (basis) {
    text = basis;
  } else {
    text = 'Шартнома топилмади';
  }

  return (
    <div className={styles.box}>
      <strong className={styles.label}>Асос:</strong>
      <span className={styles.value}>{text}</span>
    </div>
  );
};
