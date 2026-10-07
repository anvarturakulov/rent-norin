'use client';

import { useCallback } from 'react';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import {
    DocumentType,
    getSchetForDocumentType,
} from '@/app/interfaces/document.interface';
import { Product } from '@/app/interfaces/product.interface';
import { getStockByItem } from '@/app/service/stocks/getStockByItem';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import type { ReferenceModel } from '@/app/interfaces/reference.interface';
import styles from './contractTmzCatalogPicker.module.css';

export async function resolveContractTmzCostPrice(params: {
    token: string;
    enterpriseId: number;
    warehouseId?: number;
    analiticId: number;
    documentType: DocumentType;
    dateMs: number;
    fallbackCost?: number;
}): Promise<number | null> {
    const fallback = Number(params.fallbackCost) || 0;
    if (params.warehouseId && params.analiticId) {
        try {
            const schet = getSchetForDocumentType(params.documentType);
            const stock = await getStockByItem(
                schet,
                params.warehouseId,
                params.analiticId,
                params.dateMs,
                params.enterpriseId,
                params.token,
            );
            if (stock.totalQuantity > 0 && Number(stock.totalSum) > 0) {
                return Number(stock.totalSum) / Number(stock.totalQuantity);
            }
        } catch {
            // leftover fallback below
        }
    }
    if (fallback > 0) return fallback;
    if (!params.analiticId || !params.token) return null;
    try {
        const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${params.analiticId}`;
        const ref = (await getDataForSwr(url, params.token)) as ReferenceModel;
        const start = Number(ref?.refValues?.costPriceInStart) || 0;
        return start > 0 ? start : null;
    } catch {
        return null;
    }
}

interface Props {
    documentType: DocumentType;
    enterpriseId?: number;
    warehouseId?: number;
    documentDate?: number;
    displayName: string;
    hasSelection: boolean;
    selectedProductId?: number;
    onPick: (product: Product, quantity: number) => void;
    onClear?: () => void;
}

export default function ContractTmzCatalogPicker({
    documentType,
    enterpriseId,
    warehouseId,
    documentDate,
    displayName,
    hasSelection,
    selectedProductId,
    onPick,
    onClear,
}: Props) {
    const onProductSelected = useCallback(
        (product: Product, quantity: number) => {
            onPick(product, quantity > 0 ? quantity : 1);
        },
        [onPick],
    );

    const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
        onProductSelected,
        currentDocTableItems: [],
    });

    const readoutClasses = [
        styles.readout,
        hasSelection ? styles.readoutSelected : '',
        styles.readoutClickable,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            <div className={styles.row}>
                <div
                    role="button"
                    tabIndex={0}
                    className={readoutClasses}
                    onClick={() => openCatalog()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openCatalog();
                        }
                    }}
                    title="Каталогдан танлаш"
                >
                    {hasSelection ? displayName : '— каталогдан танланг —'}
                </div>
                {hasSelection && onClear ? (
                    <button
                        type="button"
                        className={styles.clearBtn}
                        onClick={onClear}
                        title="Танловни тозалаш"
                    >
                        <XMarkIcon className={styles.clearBtnIcon} aria-hidden />
                    </button>
                ) : null}
                <button
                    type="button"
                    className={styles.catalogBtn}
                    onClick={openCatalog}
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
                typeDocumentByComeOut="out"
                documentType={documentType}
                documentDate={documentDate ?? Date.now()}
                referenceEnterpriseId={enterpriseId}
                warehouseId={warehouseId}
                allowNegativeStock
                catalogMode="pick"
                focusProduct={selectedProductId ? { id: selectedProductId } : undefined}
            />
        </>
    );
}
