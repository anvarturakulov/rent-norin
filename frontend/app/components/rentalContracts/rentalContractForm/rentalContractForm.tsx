'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import styles from './rentalContractForm.module.css';
import { rentalContractsApi } from '@/app/service/rentalContracts/rentalContracts.service';
import {
    RentalContractStatus,
    type SaveRentalContractPayload,
} from '@/app/interfaces/rentalContract.interface';
import type { ReferenceModel } from '@/app/interfaces/reference.interface';
import { ReferencesService } from '@/app/service/references/references.service';
import ContractClientSelect from '@/app/components/clientContracts/contractClientSelect/contractClientSelect';
import RentalContractPrintDocument from '../rentalContractPrintDocument/rentalContractPrintDocument';
import { buildRentalContractPrintData } from '../rentalContractPrintDocument/buildRentalContractPrintData';
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

function dateToMs(isoDate: string): number {
    return parseDateInputValue(isoDate) ?? nowMs();
}

function msToIsoDate(ms?: number | null): string {
    if (ms == null || !Number.isFinite(Number(ms))) return '';
    return formatDateForInput(Number(ms));
}

interface Props {
    token: string;
    enterpriseId: number;
    contractId: number | null;
    onClose: () => void;
    onSaved: () => void;
    onDeleted?: () => void;
}

export default function RentalContractForm({
    token,
    enterpriseId,
    contractId,
    onClose,
    onSaved,
    onDeleted,
}: Props) {
    const [contractNumber, setContractNumber] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [contractDate, setContractDate] = useState(() =>
        formatDateForInput(nowMs()),
    );
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<RentalContractStatus>(RentalContractStatus.DRAFT);
    const [comment, setComment] = useState('');
    const [previewNumber, setPreviewNumber] = useState('');
    const [loading, setLoading] = useState(!!contractId);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
    const [deleteConfirmError, setDeleteConfirmError] = useState('');
    const [deletingContract, setDeletingContract] = useState(false);
    const [error, setError] = useState('');
    const [clientDetails, setClientDetails] = useState<ReferenceModel | null>(null);

    const printContractRef = useRef<HTMLDivElement>(null);

    const displayContractNumber = contractId
        ? contractNumber
        : previewNumber || contractNumber;

    const handlePrintContract = useReactToPrint({
        contentRef: printContractRef,
        documentTitle: `Ijara-shartnoma-${displayContractNumber || 'new'}`,
        pageStyle: `
            @page {
                size: A4 portrait;
                margin: 12mm;
            }
            @media print {
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `,
    });

    const printData = useMemo(
        () =>
            buildRentalContractPrintData({
                contractNumber: displayContractNumber,
                contractDateMs: dateToMs(contractDate),
                endDateMs: endDate ? dateToMs(endDate) : null,
                client: clientDetails,
            }),
        [clientDetails, contractDate, displayContractNumber, endDate],
    );

    useEffect(() => {
        if (!contractId) return;
        let cancelled = false;
        setLoading(true);
        rentalContractsApi
            .getOne(token, contractId)
            .then((c) => {
                if (cancelled) return;
                setContractNumber(c.contractNumber);
                setClientId(String(c.clientId));
                setClientName(c.client?.name ?? '');
                setContractDate(msToIsoDate(c.contractDate) || formatDateForInput(nowMs()));
                setEndDate(msToIsoDate(c.endDate));
                setStatus(c.status ?? RentalContractStatus.DRAFT);
                setComment(c.comment ?? '');
            })
            .catch((e: Error) => !cancelled && setError(e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [contractId, token]);

    useEffect(() => {
        if (contractId) return;
        const year = new Date(dateToMs(contractDate)).getFullYear();
        let cancelled = false;
        rentalContractsApi
            .previewNumber(token, enterpriseId, year)
            .then((r) => {
                if (cancelled) return;
                setPreviewNumber(r.contractNumber);
                setContractNumber((current) =>
                    current.trim() ? current : r.contractNumber,
                );
            })
            .catch(() => {
                if (!cancelled) setPreviewNumber('');
            });
        return () => {
            cancelled = true;
        };
    }, [contractId, contractDate, enterpriseId, token]);

    useEffect(() => {
        const cid = Number(clientId);
        if (!clientId || !Number.isFinite(cid)) {
            setClientDetails(null);
            return;
        }
        let cancelled = false;
        ReferencesService.getReferenceById(cid, token)
            .then((ref) => !cancelled && setClientDetails(ref))
            .catch(() => !cancelled && setClientDetails(null));
        return () => {
            cancelled = true;
        };
    }, [clientId, token]);

    const handleSave = useCallback(async () => {
        if (!contractNumber.trim()) {
            setError('Шартнома рақамини киритинг');
            return;
        }
        if (!clientId) {
            setError('Мижозни танланг');
            return;
        }
        setSaving(true);
        setError('');
        const payload: SaveRentalContractPayload = {
            enterpriseId,
            clientId: Number(clientId),
            contractDate: dateToMs(contractDate),
            endDate: endDate ? dateToMs(endDate) : null,
            status,
            comment: comment.trim() || null,
            contractNumber: contractNumber.trim(),
        };
        try {
            if (contractId) {
                await rentalContractsApi.update(token, contractId, payload);
            } else {
                await rentalContractsApi.create(token, payload);
            }
            onSaved();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Хатолик');
        } finally {
            setSaving(false);
        }
    }, [
        clientId,
        comment,
        contractDate,
        contractId,
        contractNumber,
        endDate,
        enterpriseId,
        onSaved,
        status,
        token,
    ]);

    const openDeleteConfirm = useCallback(() => {
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
        setShowDeleteConfirm(true);
    }, []);

    const closeDeleteConfirm = useCallback(() => {
        if (deletingContract) return;
        setShowDeleteConfirm(false);
        setDeleteConfirmInput('');
        setDeleteConfirmError('');
    }, [deletingContract]);

    const handleConfirmDeleteContract = useCallback(async () => {
        if (!contractId) return;
        const entered = deleteConfirmInput.trim();
        if (entered !== contractNumber.trim()) {
            setDeleteConfirmError('Шартнома рақами мос келмади');
            return;
        }
        setDeleteConfirmError('');
        setDeletingContract(true);
        try {
            await rentalContractsApi.delete(token, contractId);
            setShowDeleteConfirm(false);
            onDeleted?.();
        } catch (e: unknown) {
            setDeleteConfirmError(
                e instanceof Error ? e.message : 'Ўчиришда хатолик',
            );
        } finally {
            setDeletingContract(false);
        }
    }, [contractId, contractNumber, deleteConfirmInput, onDeleted, token]);

    return (
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
                <h3>{contractId ? 'Ижара шартномаси' : 'Янги ижара шартномаси'}</h3>
                <button type="button" className={styles.closeBtn} onClick={onClose}>
                    ×
                </button>
            </div>

            {loading ? <p>Юкланмоқда…</p> : null}
            {error ? <div className={styles.error}>{error}</div> : null}

            {!loading && (
                <>
                    <div className={styles.field}>
                        <label>Шартнома №</label>
                        <input
                            type="text"
                            value={contractNumber}
                            onChange={(e) => setContractNumber(e.target.value)}
                            placeholder={
                                !contractId
                                    ? previewNumber ||
                                      `001-${new Date(dateToMs(contractDate)).getFullYear()}`
                                    : undefined
                            }
                        />
                        {!contractId && previewNumber ? (
                            <div className={styles.numberHint}>
                                Автоматик рақам: {previewNumber}
                            </div>
                        ) : null}
                    </div>

                    <ContractClientSelect
                        label="Мижоз"
                        token={token}
                        enterpriseId={enterpriseId}
                        value={clientId}
                        onChange={(id, name) => {
                            setClientId(id);
                            setClientName(name);
                        }}
                    />

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label>Бошланиш санаси</label>
                            <input
                                type="date"
                                value={contractDate}
                                onChange={(e) => setContractDate(e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label>Тугаш санаси</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Статус</label>
                        <select
                            value={status}
                            onChange={(e) =>
                                setStatus(e.target.value as RentalContractStatus)
                            }
                        >
                            <option value={RentalContractStatus.DRAFT}>Қоралама</option>
                            <option value={RentalContractStatus.APPROVED}>Тасдиқланган</option>
                            <option value={RentalContractStatus.COMPLETED}>Якунланган</option>
                            <option value={RentalContractStatus.CANCELLED}>Бекор қилинган</option>
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label>Изоҳ</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={clientName ? `Мижоз: ${clientName}` : undefined}
                        />
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.printBtn}
                            onClick={() => handlePrintContract()}
                            disabled={!clientId || saving}
                        >
                            Шартнома
                        </button>
                        <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => void handleSave()}
                            disabled={saving}
                        >
                            {saving ? 'Сақланмоқда…' : 'Сақлаш'}
                        </button>
                        {contractId ? (
                            <button
                                type="button"
                                className={styles.deleteBtn}
                                onClick={openDeleteConfirm}
                                disabled={saving || deletingContract}
                            >
                                {deletingContract ? 'Ўчирилмоқда…' : 'Ўчириш'}
                            </button>
                        ) : null}
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Бекор
                        </button>
                    </div>

                    <div className={styles.printOffscreen} aria-hidden>
                        <RentalContractPrintDocument ref={printContractRef} data={printData} />
                    </div>
                </>
            )}

            {showDeleteConfirm && contractId != null && (
                <div
                    className={styles.deleteConfirmOverlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeDeleteConfirm();
                    }}
                >
                    <div
                        className={styles.deleteConfirmBox}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.deleteConfirmTitle}>
                            Шартномани ўчириш?
                        </h3>
                        <p className={styles.deleteConfirmText}>
                            Ижара шартномаси базадан ўчирилади. Амални қайтариб
                            бўлмайди. Тасдиқлаш учун шартнома рақамини киритинг:{' '}
                            <strong>{contractNumber.trim()}</strong>
                        </p>
                        <input
                            type="text"
                            className={styles.deleteConfirmInput}
                            value={deleteConfirmInput}
                            onChange={(e) => {
                                setDeleteConfirmInput(e.target.value);
                                if (deleteConfirmError) setDeleteConfirmError('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    void handleConfirmDeleteContract();
                                }
                            }}
                            placeholder="Шартнома рақами"
                            autoFocus
                            disabled={deletingContract}
                        />
                        {deleteConfirmError && (
                            <div className={styles.deleteConfirmError}>
                                {deleteConfirmError}
                            </div>
                        )}
                        <div className={styles.deleteConfirmActions}>
                            <button
                                type="button"
                                className={styles.deleteConfirmCancelBtn}
                                onClick={closeDeleteConfirm}
                                disabled={deletingContract}
                            >
                                Бекор қилиш
                            </button>
                            <button
                                type="button"
                                className={styles.deleteConfirmSubmitBtn}
                                onClick={() => void handleConfirmDeleteContract()}
                                disabled={
                                    deletingContract ||
                                    deleteConfirmInput.trim() === ''
                                }
                            >
                                {deletingContract ? 'Ўчирилмоқда…' : 'Ўчириш'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
