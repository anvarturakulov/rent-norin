'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DocTableItem, DocumentModel } from '@/app/interfaces/document.interface';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import { numberValue } from '@/app/service/common/converters';
import { fetchTransferToolsPreview } from '@/app/service/documents/fetchTransferToolsPreview';
import {
  buildTransferPickerRowsFromPreview,
  mergeTransferPickerSelectionsIntoDocument,
  TransferPickerSelectionRow,
} from '@/app/service/documents/applyTransferToolsPicker';
import { showMessage } from '@/app/service/common/showMessage';
import styles from './transferToolsPickerModal.module.css';

interface TransferToolsPickerModalProps {
  open: boolean;
  currentDocument: DocumentModel;
  allDocItems: DocTableItem[];
  token: string | undefined;
  enterpriseId: number | null | undefined;
  setMainData: Function | undefined;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function TransferToolsPickerModal({
  open,
  currentDocument,
  allDocItems,
  token,
  enterpriseId,
  setMainData,
  onClose,
}: TransferToolsPickerModalProps) {
  const { data: references } = useAllReferences(token);
  const [rows, setRows] = useState<TransferPickerSelectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const referenceMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ref of references || []) {
      if (ref.id) map.set(ref.id, ref.name || `ID ${ref.id}`);
    }
    return map;
  }, [references]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setApplyError(null);
    try {
      const preview = await fetchTransferToolsPreview(currentDocument, token, enterpriseId);
      setRows(buildTransferPickerRowsFromPreview(preview, allDocItems));
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Yuklashda xatolik';
      setLoadError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentDocument, allDocItems, enterpriseId, token]);

  useEffect(() => {
    if (open) {
      loadPreview();
    } else {
      setRows([]);
      setLoadError(null);
      setApplyError(null);
    }
  }, [open, loadPreview]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const nameA = referenceMap.get(a.analiticId) || `ID ${a.analiticId}`;
      const nameB = referenceMap.get(b.analiticId) || `ID ${b.analiticId}`;
      return nameA.localeCompare(nameB, 'uz');
    });
  }, [rows, referenceMap]);

  const handleTransferQtyChange = (analiticId: number, value: string) => {
    const parsed = value === '' ? 0 : Number(value);
    setRows((prev) =>
      prev.map((row) =>
        row.analiticId === analiticId
          ? { ...row, transferQty: Number.isFinite(parsed) ? parsed : 0 }
          : row,
      ),
    );
  };

  const handleFillAll = () => {
    setRows((prev) => prev.map((row) => ({ ...row, transferQty: row.remainQty })));
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const result = await mergeTransferPickerSelectionsIntoDocument(
        currentDocument,
        rows,
        token,
        enterpriseId,
      );
      if ('error' in result) {
        setApplyError(result.error);
        return;
      }

      setMainData?.('currentDocument', {
        ...currentDocument,
        docTableItems: result.docTableItems,
      });

      const updatedCount = rows.filter((r) => (Number(r.transferQty) || 0) > 0).length;
      showMessage(
        `Ko'chirildi: ${updatedCount} qator`,
        'success',
        setMainData,
      );
      onClose();
    } catch (error: any) {
      setApplyError(error?.message || 'Xatolik yuz berdi');
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const hasSelection = rows.some((row) => (Number(row.transferQty) || 0) > 0);

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h3 className={styles.title}>Складдаги ускуналарни танлаб олиш</h3>
        <p className={styles.subtitle}>
          Склад қолдиғи бўйича ускуналар. Топшириш миқдорини киритинг.
        </p>

        <div className={styles.body}>
          {loading && <div className={styles.empty}>Yuklanmoqda…</div>}
          {!loading && loadError && <div className={styles.error}>{loadError}</div>}
          {!loading && !loadError && sortedRows.length === 0 && (
            <div className={styles.empty}>Складда қолдиқли ускуналар йўқ</div>
          )}
          {!loading && !loadError && sortedRows.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colName}>Номи</th>
                  <th className={styles.colNum}>Тариф</th>
                  <th className={styles.colNum}>Қолдиқ</th>
                  <th className={styles.colQty}>Топширилади</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const name = referenceMap.get(row.analiticId) || `ID ${row.analiticId}`;
                  const dailyTariff = round2((Number(row.hourlyTariff) || 0) * 24);
                  return (
                    <tr key={row.analiticId}>
                      <td className={styles.colName}>{name}</td>
                      <td className={styles.colNum}>{numberValue(dailyTariff)} сўм</td>
                      <td className={styles.colNum}>{row.remainQty}</td>
                      <td className={styles.colQty}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={styles.qtyInput}
                          value={row.transferQty || ''}
                          onChange={(e) =>
                            handleTransferQtyChange(row.analiticId, e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {applyError && <div className={styles.error}>{applyError}</div>}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleFillAll}
            disabled={loading || applying || rows.length === 0}
          >
            Ҳаммасини тулдириш
          </button>
          <div className={styles.footerEnd}>
            <button type="button" className={styles.btn} onClick={onClose} disabled={applying}>
              Бекор қилиш
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleApply}
              disabled={loading || applying || !hasSelection}
            >
              Ҳужжатга кучириш
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
