'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import styles from './DebitKreditOborotModal.module.css';
import { DEBETKREDIT, EntryItem, Schet } from '@/app/interfaces/report.interface';

/** Обороты в проводках: склад+номенклатура (TMZ) или склад+ОС (S01/S02) */
const SECOND_SUBCONTO_DRILL_SCHETS: Schet[] = [
  Schet.S10,
  Schet.S28,
  Schet.S21,
  Schet.S11,
  Schet.S12,
  Schet.S01,
  Schet.S02,
];
import { numberValue } from '@/app/service/common/converters';
import { fetchAnaliticEntries } from '@/app/service/reports/getAnalitic';
import { useAppContext } from '@/app/context/app.context';
import { MatOborotEntriesModal } from '@/app/components/reports/simpleReports/reportTable/table/matOborot/matOborotItem/MatOborotEntriesModal';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';

export type OborotSubcontoItem = {
  id: number;
  name: string;
  value: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  schet: Schet | string;
  dk: DEBETKREDIT;
  items: OborotSubcontoItem[];
};

export function DebitKreditOborotModal({
  isOpen,
  onClose,
  title,
  schet,
  dk,
  items,
}: Props) {
  const { mainData, setMainData } = useAppContext();
  const { dateStart, dateEnd } = mainData.journal.interval;
  const [entriesModal, setEntriesModal] = useState<{
    open: boolean;
    loading: boolean;
    title: string;
    entries: EntryItem[];
  }>({ open: false, loading: false, title: '', entries: [] });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !entriesModal.open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, entriesModal.open]);

  useEffect(() => {
    if (isOpen && !entriesModal.open) document.body.style.overflow = 'hidden';
    else if (!entriesModal.open) document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, entriesModal.open]);

  const closeEntriesModal = useCallback(() => {
    setEntriesModal({ open: false, loading: false, title: '', entries: [] });
  }, []);

  const openSubcontoEntries = useCallback(
    async (subconto: OborotSubcontoItem) => {
      const entryTitle = `${subconto.name} — ${title}`;
      setEntriesModal({ open: true, loading: true, title: entryTitle, entries: [] });
      try {
        const schetKey = String(schet);
        const drillBySecondSubconto = SECOND_SUBCONTO_DRILL_SCHETS.some(
          (s) => String(s) === schetKey,
        );
        const entries = await fetchAnaliticEntries(
          mainData,
          drillBySecondSubconto ? 0 : subconto.id,
          drillBySecondSubconto ? subconto.id : undefined,
          dk,
          schet as Schet,
          { startDate: dateStart, endDate: dateEnd },
        );
        const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
        setEntriesModal({ open: true, loading: false, title: entryTitle, entries: sortedEntries });
      } catch {
        setEntriesModal({ open: true, loading: false, title: entryTitle, entries: [] });
      }
    },
    [mainData, title, dk, schet, dateStart, dateEnd],
  );

  const handleSelectDocument = useCallback(
    (docId: number) => {
      closeEntriesModal();
      onClose();
      void getDocument(
        docId,
        setMainData,
        mainData.users.user?.token,
        mainData,
        mainData.document.contentName,
      );
    },
    [closeEntriesModal, onClose, setMainData, mainData],
  );

  if (typeof document === 'undefined') return null;

  return (
    <>
      {isOpen
        ? createPortal(
        <div
          className={`${styles.overlay} ${entriesModal.open ? styles.overlayBehind : ''}`}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !entriesModal.open) onClose();
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dk-oborot-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.head}>
              <h2 id="dk-oborot-modal-title" className={styles.title}>
                {title}
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Ёпиш"
              >
                ×
              </button>
            </div>
            <p className={styles.subtitle}>Субконто бўйича оборот</p>

            <div className={styles.body}>
              {items.length === 0 ? (
                <div className={styles.empty}>Маълумот топилмади</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.numCol}>№</th>
                        <th className={styles.nameCol}>Номи</th>
                        <th className={styles.amountCol}>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr
                          key={`${item.id}-${index}`}
                          className={styles.row}
                          role="button"
                          tabIndex={0}
                          title="Проводкаларни кўриш"
                          onClick={() => void openSubcontoEntries(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void openSubcontoEntries(item);
                            }
                          }}
                        >
                          <td className={styles.numCol}>{index + 1}</td>
                          <td className={styles.nameCol}>{item.name}</td>
                          <td className={styles.amountCol}>{numberValue(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className={styles.footerLabel}>
                          Жами
                        </td>
                        <td className={styles.amountCol}>
                          {numberValue(items.reduce((acc, i) => acc + i.value, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {items.length > 0 ? (
              <div className={styles.footer}>
                <p className={styles.footerHint}>Қаторни босинг — проводкаларни кўриш</p>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )
        : null}

      <MatOborotEntriesModal
        isOpen={entriesModal.open}
        onClose={closeEntriesModal}
        title={entriesModal.title}
        loading={entriesModal.loading}
        entries={entriesModal.entries}
        references={mainData.reference?.allReferences}
        onSelectDocument={handleSelectDocument}
        elevated
      />
    </>
  );
}
