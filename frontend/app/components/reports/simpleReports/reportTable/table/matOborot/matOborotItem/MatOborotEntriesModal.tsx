'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from './MatOborotEntriesModal.module.css';
import { EntryItem } from '@/app/interfaces/report.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { secondsToDateString } from '@/app/components/documents/document/doc/helpers/doc.functions';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { getNameReference } from '@/app/components/journals/journal/helpers/journal.functions';
import { numberValue } from '@/app/service/common/converters';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  loading: boolean;
  entries: EntryItem[];
  references: ReferenceModel[] | undefined;
  onSelectDocument: (docId: number) => void;
  /** Поверх вложенной модалки (дебитор-кредитор оборот) */
  elevated?: boolean;
};

function formatSubcontoLine(
  references: ReferenceModel[] | undefined,
  firstId: string | undefined,
  secondId: string | undefined,
): string {
  const parts: string[] = [];
  if (firstId) {
    const name = getNameReference(references, firstId);
    if (name && name !== 'Аникланмади') parts.push(name);
  }
  if (secondId) {
    const name = getNameReference(references, secondId);
    if (name && name !== 'Аникланмади') parts.push(name);
  }
  return parts.join(' / ');
}

export function MatOborotEntriesModal({
  isOpen,
  onClose,
  title,
  loading,
  entries,
  references,
  onSelectDocument,
  elevated = false,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={elevated ? `${styles.overlay} ${styles.overlayElevated}` : styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mat-oborot-entries-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id="mat-oborot-entries-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Ёпиш">
            ×
          </button>
        </div>
        <p className={styles.subtitle}>Проводки / операции</p>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>Маълумот юкланмокда...</div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>Маълумот топилмади</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.numCol}>№</th>
                    <th className={styles.dateCol}>Сана</th>
                    <th className={styles.docCol}>Хужжат</th>
                    <th>Дебет</th>
                    <th>Кредит</th>
                    <th className={styles.amountCol}>Сон</th>
                    <th className={styles.amountCol}>Сумма</th>
                    <th className={styles.commentCol}>Изох</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const docId = Number(entry.docId);
                    const docTypeLabel =
                      getDescriptionDocument(String(entry.documentType)) || String(entry.documentType);
                    const debetSubconto = formatSubcontoLine(
                      references,
                      entry.debetFirstSubcontoId,
                      entry.debetSecondSubcontoId,
                    );
                    const kreditSubconto = formatSubcontoLine(
                      references,
                      entry.kreditFirstSubcontoId,
                      entry.kreditSecondSubcontoId,
                    );
                    const comment = entry.fullDescription || entry.description || '';

                    return (
                      <tr
                        key={`${entry.docId}-${entry.date}-${index}`}
                        className={styles.row}
                        role="button"
                        tabIndex={0}
                        title="Хужжатни очиш"
                        onClick={() => {
                          if (docId > 0) onSelectDocument(docId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (docId > 0) onSelectDocument(docId);
                          }
                        }}
                      >
                        <td className={styles.numCol}>{index + 1}</td>
                        <td className={styles.dateCol}>{secondsToDateString(entry.date)}</td>
                        <td className={styles.docCol}>
                          {docId > 0 ? `#${docId}` : '—'}
                          <br />
                          <span className={styles.subcontoCol}>{docTypeLabel}</span>
                        </td>
                        <td>
                          {entry.debet}
                          {debetSubconto ? (
                            <>
                              <br />
                              <span className={styles.subcontoCol}>{debetSubconto}</span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          {entry.kredit}
                          {kreditSubconto ? (
                            <>
                              <br />
                              <span className={styles.subcontoCol}>{kreditSubconto}</span>
                            </>
                          ) : null}
                        </td>
                        <td className={styles.amountCol}>
                          {entry.count > 0 ? numberValue(entry.count) : '—'}
                        </td>
                        <td className={styles.amountCol}>{numberValue(entry.total)}</td>
                        <td className={styles.commentCol}>{comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && entries.length > 0 ? (
          <div className={styles.footer}>
            <p className={styles.footerHint}>Қаторни босинг — хужжат очiladi</p>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
