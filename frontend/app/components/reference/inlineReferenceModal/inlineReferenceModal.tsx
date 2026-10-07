'use client'
import { useEffect, useMemo } from 'react';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { Reference } from '../reference';
import styles from './inlineReferenceModal.module.css';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { InlineCreationEntry, InlineCreationSlotKey } from '@/app/context/app.context.interfaces';
import { getInlineReferenceModalTitle } from './getInlineReferenceModalTitle';
import { getReference } from '@/app/components/lists/referencesList/helpers/references.functions';

interface InlineReferenceModalLayerProps {
    entry: InlineCreationEntry;
    slotKey: InlineCreationSlotKey;
    isTop: boolean;
    nested?: boolean;
}

const InlineReferenceModalLayer = ({ entry, slotKey, isTop, nested }: InlineReferenceModalLayerProps): JSX.Element | null => {
    const { mainData, setMainData } = useAppContext();
    const currentReference = mainData.reference?.currentReference;
    const token = mainData.users?.user?.token;
    const referenceId = entry.referenceId;
    const isEditMode = referenceId != null;
    const isReferenceLoaded = !isEditMode || currentReference?.id === referenceId;
    const { showMessageWindow, message, messageType } = mainData.window;
    const inlineError =
        isTop &&
        showMessageWindow &&
        messageType === 'error' &&
        typeof message === 'string' &&
        message.trim()
            ? message
            : null;

    const closeModal = () => {
        if (!setMainData) return;
        setMainData(slotKey, null);
    };

    const isValidType = useMemo(() => {
        if (!entry.typeReference) return false;
        return Object.values(TypeReference).includes(entry.typeReference as TypeReference);
    }, [entry.typeReference]);

    const hasInstanceId = useMemo(() => {
        const id = entry.instanceId;
        if (id == null || id === '') return false;
        return String(id).trim().length > 0;
    }, [entry.instanceId]);

    // Escape закрывает только верхнюю модалку, иначе закрылись бы оба слоя сразу.
    useEffect(() => {
        if (!isTop) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeModal();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isTop, slotKey]);

    useEffect(() => {
        if (!setMainData) return;
        if (!isValidType || !hasInstanceId) {
            setMainData(slotKey, null);
        }
    }, [isValidType, hasInstanceId, setMainData, slotKey]);

    useEffect(() => {
        if (!referenceId || !setMainData || !token) return;
        getReference(referenceId, setMainData, token);
    }, [referenceId, setMainData, token]);

    if (!isValidType || !hasInstanceId) return null;

    const modalTitle = getInlineReferenceModalTitle(entry.typeReference, isEditMode);
    const titleId = `inline-reference-modal-title-${slotKey}`;
    const referenceKey = `${entry.instanceId}-${referenceId ?? 'new'}`;

    return (
        <div
            className={cn(styles.overlay, { [styles.overlayNested]: nested })}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    e.stopPropagation();
                }
            }}
        >
            <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={closeModal}
                    aria-label="Ёпиш"
                >
                    ✕
                </button>
                <h2 id={titleId} className={styles.modalTitle}>
                    {modalTitle}
                </h2>
                {inlineError && (
                    <div className={styles.errorBanner} role="alert">
                        {inlineError}
                    </div>
                )}
                {isEditMode && !isReferenceLoaded ? (
                    <div className={styles.loading}>Юкланмоқда...</div>
                ) : (
                    <Reference
                        key={referenceKey}
                        inlineMode
                        inlineEntry={entry}
                        inlineSlotKey={slotKey}
                        typeReferenceOverride={entry.typeReference}
                    />
                )}
            </div>
        </div>
    );
};

export const InlineReferenceModal = (): JSX.Element | null => {
    const { mainData } = useAppContext();
    const base = mainData.reference?.inlineCreation;
    const nested = mainData.reference?.nestedInlineCreation;

    if (!base && !nested) return null;

    return (
        <>
            {base && (
                <InlineReferenceModalLayer
                    entry={base}
                    slotKey="reference.inlineCreation"
                    isTop={!nested}
                />
            )}
            {nested && (
                <InlineReferenceModalLayer
                    entry={nested}
                    slotKey="reference.nestedInlineCreation"
                    isTop
                    nested
                />
            )}
        </>
    );
};
