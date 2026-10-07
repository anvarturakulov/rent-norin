'use client';

import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Schet } from '@/app/interfaces/report.interface';
import { numberValue } from '@/app/service/common/converters';
import {
  computeOperationsAfterBalance,
  getBalanceTargetDate,
  getReceiveToolsOperationsSummary,
} from './clientBalanceCalculations';
import styles from './clientOperationsSummary.module.css';

const formatSum = (value: number): string => `${numberValue(value)}`;

type SummaryRow = {
  key: string;
  label: string;
  value: number | null;
  sign?: '+' | '−';
  isTotal?: boolean;
};

export const ClientOperationsSummary = (): JSX.Element | null => {
  const { mainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { user } = mainData.users;
  const documentType = currentDocument?.documentType;
  const clientId =
    documentType === DocumentType.ReceiveToolsFromClient ||
    documentType === DocumentType.ReceiveSubleaseToolsFromClient
      ? currentDocument?.docValues?.senderId
      : undefined;
  const endDate = getBalanceTargetDate(currentDocument?.date);
  const enterpriseId = currentDocument?.enterpriseId ?? user?.enterpriseId;

  const [beforeDebt, setBeforeDebt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const summary = useMemo(
    () =>
      getReceiveToolsOperationsSummary(
        currentDocument?.docValues,
        currentDocument?.docTableItems,
      ),
    [currentDocument?.docValues, currentDocument?.docTableItems],
  );

  const afterDebt =
    beforeDebt != null ? computeOperationsAfterBalance(beforeDebt, summary) : null;

  const fetchBalance = useCallback(async () => {
    const params = new URLSearchParams({
      schet: Schet.S40,
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
  }, [clientId, endDate, enterpriseId, user?.token]);

  const handleRefresh = useCallback(async () => {
    if (!clientId || clientId <= 0 || !user?.token) return;
    setLoading(true);
    try {
      const debt = await fetchBalance();
      setBeforeDebt(debt);
    } catch {
      setBeforeDebt(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, fetchBalance, user?.token]);

  if (!clientId || clientId <= 0) {
    return null;
  }

  const rows: SummaryRow[] = [
    { key: 'before', label: 'Мижоз қарзи бошида', value: beforeDebt },
    { key: 'rent', label: 'Ижарадан даромад', value: summary.rentIncome, sign: '+' },
    { key: 'sale', label: 'Ускуна сотишдан даромад', value: summary.saleIncome, sign: '+' },
    { key: 'tovar', label: 'Товар сотиш', value: summary.tovarIncome, sign: '+' },
    { key: 'payments', label: 'Тўловлар', value: summary.payments, sign: '−' },
    {
      key: 'defect',
      label: 'Брак буйича харажатлар',
      value: summary.defectCost,
      sign: '+',
    },
    { key: 'delivery', label: 'Доставка', value: summary.deliverySum, sign: '+' },
    {
      key: 'changeToClient',
      label: 'Кайтим',
      value: summary.changeToClient,
      sign: '+',
    },
    {
      key: 'after',
      label: 'Қолдиқ хужжатдан кейин',
      value: afterDebt,
      isTotal: true,
    },
  ];

  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? '...' : 'Янгилаш'}
        </button>
      </div>

      <div className={styles.list}>
        {rows.map((row) => (
          <div
            key={row.key}
            className={row.isTotal ? `${styles.row} ${styles.totalRow}` : styles.row}
          >
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>
              {row.value != null ? (
                <>
                  {row.sign ? <span className={styles.sign}>{row.sign}</span> : null}
                  {formatSum(row.value)}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
