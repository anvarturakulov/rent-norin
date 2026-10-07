'use client';

import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Schet } from '@/app/interfaces/report.interface';
import { numberValue } from '@/app/service/common/converters';
import {
  computeAfterBalance,
  getBalanceTargetDate,
  getDocumentBalanceValues,
} from './clientBalanceCalculations';
import styles from './clientBalanceInfo.module.css';

const formatSum = (value: number): string => `${numberValue(value)}`;

const formatCell = (value: number | null): string => {
  if (value === null) return '—';
  return formatSum(value);
};

export const ClientBalanceInfo = (): JSX.Element | null => {
  const { mainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const documentType = currentDocument?.documentType;
  const showToolsBalance =
    documentType !== DocumentType.SaleTovar &&
    documentType !== DocumentType.SaleTools;
  const clientId =
    documentType === DocumentType.ReceiveToolsFromClient ||
    documentType === DocumentType.ReceiveSubleaseToolsFromClient
      ? currentDocument?.docValues?.senderId
      : currentDocument?.docValues?.receiverId;
  const endDate = getBalanceTargetDate(currentDocument?.date);
  const enterpriseId = currentDocument?.enterpriseId ?? user?.enterpriseId;

  const [beforeS40, setBeforeS40] = useState<number | null>(null);
  const [beforeS12, setBeforeS12] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const documentValues = useMemo(
    () =>
      getDocumentBalanceValues(
        documentType,
        currentDocument?.docValues,
        currentDocument?.docTableItems,
      ),
    [documentType, currentDocument?.docValues, currentDocument?.docTableItems],
  );

  const afterS40 =
    beforeS40 != null
      ? computeAfterBalance(
          documentType,
          beforeS40,
          documentValues.s40.income,
          documentValues.s40.expense,
          's40',
        )
      : null;

  const afterS12 =
    beforeS12 != null
      ? computeAfterBalance(
          documentType,
          beforeS12,
          documentValues.s12.income,
          documentValues.s12.expense,
          's12',
        )
      : null;

  const fetchBalance = useCallback(
    async (schet: Schet) => {
      const params = new URLSearchParams({
        schet,
        endDate: String(endDate),
        firstSubcontoId: String(clientId),
      });
      if (enterpriseId != null) {
        params.set('enterpriseId', String(enterpriseId));
      }

      const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/priceAndBalance?${params.toString()}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      return Number(response.data?.balance ?? 0);
    },
    [clientId, endDate, enterpriseId, user?.token],
  );

  const handleRefresh = useCallback(async () => {
    if (!clientId || clientId <= 0 || !user?.token) return;
    setLoading(true);
    try {
      if (showToolsBalance) {
        const [debt, tools] = await Promise.all([
          fetchBalance(Schet.S40),
          fetchBalance(Schet.S12),
        ]);
        setBeforeS40(debt);
        setBeforeS12(tools);
      } else {
        setBeforeS40(await fetchBalance(Schet.S40));
        setBeforeS12(null);
      }
    } catch {
      setBeforeS40(null);
      setBeforeS12(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, fetchBalance, showToolsBalance, user?.token]);

  if (!clientId || clientId <= 0) {
    return null;
  }

  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={loading}>
          {loading ? '...' : 'Янгилаш'}
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rowLabel} />
              <th>Хужжатгача</th>
              <th>"Плюс"</th>
              <th>"Минус"</th>
              <th>Хужжатдан кейин</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.rowLabel}>Қарз (S40)</td>
              <td>{beforeS40 != null ? formatSum(beforeS40) : '—'}</td>
              <td>{formatCell(documentValues.s40.income)}</td>
              <td>{formatCell(documentValues.s40.expense)}</td>
              <td>{afterS40 != null ? formatSum(afterS40) : '—'}</td>
            </tr>
            {showToolsBalance && (
            <tr>
              <td className={styles.rowLabel}>Ускуналар (S12)</td>
              <td>{beforeS12 != null ? formatSum(beforeS12) : '—'}</td>
              <td>{formatCell(documentValues.s12.income)}</td>
              <td>{formatCell(documentValues.s12.expense)}</td>
              <td>{afterS12 != null ? formatSum(afterS12) : '—'}</td>
            </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
