'use client';

import { useEffect } from 'react';
import type { ReferenceUsageResponse } from '@/app/service/references/references.service';
import styles from './ReferenceUsageModal.module.css';

const DISPLAY_LIMIT = 50;

interface ReferenceUsageModalProps {
    open: boolean;
    itemName: string;
    usage: ReferenceUsageResponse | null;
    onClose: () => void;
}

export const ReferenceUsageModal = ({
    open,
    itemName,
    usage,
    onClose,
}: ReferenceUsageModalProps): JSX.Element | null => {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open || !usage) return null;

    const refsToShow = usage.inReferences.slice(0, DISPLAY_LIMIT);
    const docsToShow = usage.inDocuments.slice(0, DISPLAY_LIMIT);
    const related = usage.inRelated ?? [];
    const relatedToShow = related.slice(0, DISPLAY_LIMIT);

    return (
        <div
            className={styles.overlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reference-usage-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <div>
                        <h2 id="reference-usage-modal-title" className={styles.title}>
                            Боғланишлар
                        </h2>
                        <p className={styles.subtitle}>Справочник: {itemName}</p>
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Ёпиш"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.summary}>
                        <span>
                            Жами: <strong>{usage.counts.total}</strong>
                        </span>
                        <span>
                            Бошқа справочникларда: <strong>{usage.counts.inReferences}</strong>
                        </span>
                        <span>
                            Ҳужжатларда: <strong>{usage.counts.inDocuments}</strong>
                        </span>
                        <span>
                            Шартномалар ва бошқа жадвалларда: <strong>{usage.counts.inRelated ?? related.length}</strong>
                        </span>
                    </div>

                    {usage.inReferences.length > 0 && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Бошқа справочниклар</h3>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Номи</th>
                                        <th>Артикул</th>
                                        <th>Тури</th>
                                        <th>Майдон</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {refsToShow.map((ref) => (
                                        <tr key={`${ref.referenceId}-${ref.field}`}>
                                            <td>{ref.name}</td>
                                            <td>{ref.article ?? '—'}</td>
                                            <td>{ref.typeReference}</td>
                                            <td>{ref.field}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {usage.inReferences.length > DISPLAY_LIMIT && (
                                <p className={styles.moreHint}>
                                    … ва яна {usage.inReferences.length - DISPLAY_LIMIT} та
                                </p>
                            )}
                        </section>
                    )}

                    {usage.inDocuments.length > 0 && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Ҳужжатлар</h3>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Ҳужжат ID</th>
                                        <th>Тури</th>
                                        <th>Майдон</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docsToShow.map((doc) => (
                                        <tr key={`${doc.documentId}-${doc.field}`}>
                                            <td>#{doc.documentId}</td>
                                            <td>{doc.documentType ?? 'UNKNOWN'}</td>
                                            <td>{doc.field}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {usage.inDocuments.length > DISPLAY_LIMIT && (
                                <p className={styles.moreHint}>
                                    … ва яна {usage.inDocuments.length - DISPLAY_LIMIT} та
                                </p>
                            )}
                        </section>
                    )}

                    {related.length > 0 && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Шартномалар ва бошқа жадваллар</h3>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Манба</th>
                                        <th>ID</th>
                                        <th>Номи</th>
                                        <th>Майдон</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {relatedToShow.map((item) => (
                                        <tr key={`${item.source}-${item.id}-${item.field}`}>
                                            <td>{item.source}</td>
                                            <td>#{item.id}</td>
                                            <td>{item.label || '—'}</td>
                                            <td>{item.field}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {related.length > DISPLAY_LIMIT && (
                                <p className={styles.moreHint}>
                                    … ва яна {related.length - DISPLAY_LIMIT} та
                                </p>
                            )}
                        </section>
                    )}
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.okButton} onClick={onClose}>
                        Ёпиш
                    </button>
                </div>
            </div>
        </div>
    );
};
