'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import { numberValue } from '@/app/service/common/converters';
import {
  getToolsAtClientDetails,
  ToolsAtClientDetailsResult,
} from '@/app/service/reports/getToolsAtClientDetails';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import {
  formatDisplayDateOrDash,
  formatDisplayDateTime,
} from '@/app/utils/formatDisplayDate';
import styles from './AtClientDetailsModal.module.css';

export type AtClientDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  toolId: number;
  toolName: string;
  article?: string;
  warehouseQty: number;
  atClientQty: number;
  asOf: number;
};

export function AtClientDetailsModal({
  isOpen,
  onClose,
  toolId,
  toolName,
  article,
  warehouseQty,
  atClientQty,
  asOf,
}: AtClientDetailsModalProps): JSX.Element | null {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const selectedEnterpriseId = mainData.report?.selectedEnterpriseId;
  const contentName = mainData.document?.contentName;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ToolsAtClientDetailsResult | null>(null);

  const enterpriseId =
    typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
      ? (selectedEnterpriseId as { id?: number }).id
      : selectedEnterpriseId;

  const loadDetails = useCallback(async () => {
    if (!toolId || !asOf) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getToolsAtClientDetails(
        toolId,
        asOf,
        token,
        typeof enterpriseId === 'number' ? enterpriseId : null,
      );
      setData(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Маълумотларни юклашда хато';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [toolId, asOf, token, enterpriseId]);

  useEffect(() => {
    if (isOpen && toolId) {
      loadDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, toolId, loadDetails]);

  const openTransferDocument = (docId: number | null) => {
    if (!docId) return;
    getDocument(
      docId,
      setMainData,
      token,
      mainData,
      contentName ?? DocumentType.TransferToolsToClient,
    );
    onClose();
  };

  if (!isOpen) return null;

  const titleParts = [toolName];
  if (article) titleParts.push(`(${article})`);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Мижозда қолдиқ: {titleParts.join(' ')}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Ёпиш"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.summary}>
            <span>
              Қолдиқ вақти:{' '}
              <strong>{formatDisplayDateTime(asOf) || '—'}</strong>
            </span>
            <span>
              Омборда: <strong>{numberValue(warehouseQty)}</strong>
            </span>
            <span>
              Мижозда: <strong>{numberValue(atClientQty)}</strong>
            </span>
          </div>

          {loading && <div className={styles.loading}>Юкланмоқда...</div>}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button type="button" onClick={loadDetails}>
                Қайтиб уриниш
              </button>
            </div>
          )}

          {!loading && !error && data && data.clients.length === 0 && (
            <div className={styles.empty}>Мижозда қолдиқ топилмади</div>
          )}

          {!loading && !error && data && data.clients.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.center}>№</th>
                  <th>Мижоз</th>
                  <th className={styles.numeric}>Сони</th>
                  <th className={styles.center}>Узатиш санаси</th>
                  <th className={styles.center}>Хужжат</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.flatMap((client, clientIndex) => {
                  const batches =
                    client.batches?.length > 0
                      ? client.batches
                      : [
                          {
                            openQty: client.qty,
                            initialQty: client.qty,
                            settlementDate: null as number | null,
                            transferDocId: null as number | null,
                          },
                        ];

                  return batches.map((batch, batchIndex) => {
                    const rowKey = `${client.clientId}-${batch.transferDocId ?? 'x'}-${batchIndex}`;
                    const isFirst = batchIndex === 0;
                    return (
                      <tr key={rowKey}>
                        <td className={styles.center}>
                          {isFirst ? clientIndex + 1 : ''}
                        </td>
                        <td>{isFirst ? client.clientName : ''}</td>
                        <td className={styles.numeric}>
                          {numberValue(Number(batch.openQty) || 0)}
                        </td>
                        <td className={styles.center}>
                          {batch.settlementDate != null
                            ? formatDisplayDateOrDash(batch.settlementDate)
                            : 'номаълум'}
                        </td>
                        <td className={styles.center}>
                          {batch.transferDocId ? (
                            <button
                              type="button"
                              className={styles.docLink}
                              data-report-doc-anchor={batch.transferDocId}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTransferDocument(batch.transferDocId);
                              }}
                              title="Узатиш хужжатини очиш"
                            >
                              №{batch.transferDocId}
                            </button>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
                <tr>
                  <td colSpan={2} className={styles.center}>
                    <strong>Жами</strong>
                  </td>
                  <td className={styles.numeric}>
                    <strong>
                      {numberValue(Number(data.totalAtClient) || 0)}
                    </strong>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
