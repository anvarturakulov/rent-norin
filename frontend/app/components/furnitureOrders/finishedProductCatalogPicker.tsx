'use client';

import { useCallback } from 'react';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Product } from '@/app/interfaces/product.interface';
import styles from './finishedProductCatalogPicker.module.css';

export interface FinishedProductCatalogPickerProps {
    enterpriseId?: number;
    warehouseId?: number;
    documentDate?: number;
    disabled?: boolean;
    displayName: string;
    hasSelection: boolean;
    selectedProductId?: number;
    onPick: (id: number, name: string, quantity: number) => void;
    onClear?: () => void;
    readoutClassName?: string;
    rowClassName?: string;
}

export function FinishedProductCatalogPicker({
    enterpriseId,
    warehouseId,
    documentDate,
    disabled,
    displayName,
    hasSelection,
    selectedProductId,
    onPick,
    onClear,
    readoutClassName,
    rowClassName,
}: FinishedProductCatalogPickerProps) {
    const onProductSelected = useCallback(
        (product: Product, quantity: number) => {
            const q = quantity > 0 ? quantity : 1;
            onPick(product.id, product.name, q);
        },
        [onPick],
    );

    const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
        onProductSelected,
        currentDocTableItems: [],
    });

    const readoutClasses = [
        styles.readout,
        readoutClassName,
        hasSelection ? styles.readoutSelected : '',
        !disabled ? styles.readoutClickable : styles.readoutDisabled,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            <div className={[styles.row, rowClassName].filter(Boolean).join(' ')}>
                <div
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    className={readoutClasses}
                    onClick={() => {
                        if (!disabled) openCatalog();
                    }}
                    onKeyDown={(e) => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            openCatalog();
                        }
                    }}
                    title={disabled ? undefined : 'Каталогдан танлаш'}
                >
                    {hasSelection ? displayName : '— каталогдан танланг —'}
                </div>
                {hasSelection && onClear ? (
                    <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={onClear}
                        disabled={disabled}
                        title="Танловни тозалаш"
                    >
                        <XMarkIcon className={styles.clearBtnIcon} aria-hidden />
                        <span>Очистить</span>
                    </button>
                ) : null}
                <button
                    type="button"
                    className={styles.catalogBtn}
                    onClick={openCatalog}
                    disabled={disabled}
                    title="Каталогни очиш"
                    aria-label="Каталогни очиш"
                >
                    <Squares2X2Icon className={styles.catalogBtnIcon} aria-hidden />
                </button>
            </div>
            <ProductCatalog
                isOpen={isOpen}
                onClose={closeCatalog}
                onSelectProduct={handleSelectProduct}
                typeDocumentByComeOut="come"
                documentType={DocumentType.ComeMaterial}
                documentDate={documentDate ?? Date.now()}
                referenceEnterpriseId={enterpriseId}
                warehouseId={warehouseId}
                focusProduct={selectedProductId ? { id: selectedProductId } : undefined}
            />
        </>
    );
}
