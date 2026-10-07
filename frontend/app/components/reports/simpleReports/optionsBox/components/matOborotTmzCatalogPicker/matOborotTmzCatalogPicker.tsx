'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAppContext } from '@/app/context/app.context';
import { useProductCatalog } from '@/app/hooks/useProductCatalog';
import ProductCatalog from '@/app/components/productCatalog/productCatalog';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Product } from '@/app/interfaces/product.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import pickerStyles from '@/app/components/furnitureOrders/finishedProductCatalogPicker.module.css';
import styles from '../selectReference/selectReference.module.css';

const formatTmzLabel = (name?: string, article?: string): string => {
    const n = name?.trim() || '';
    const a = article?.trim();
    if (n && a) return `${n} (${a})`;
    return n || a || '';
};

export function MatOborotTmzCatalogPicker(): JSX.Element {
    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users;
    const { reportOption, selectedEnterpriseId } = mainData.report;
    const token = user?.token;
    const secondReferenceId = reportOption?.secondReferenceId;

    const referenceEnterpriseId = useMemo(() => {
        const isGlobal = user?.role && isGlobalRole(user.role);
        const canUseSelected = isGlobal || user?.superKassir === true;
        if (canUseSelected) {
            if (typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null) {
                return (selectedEnterpriseId as { id?: number })?.id ?? null;
            }
            return selectedEnterpriseId ?? null;
        }
        return user?.enterpriseId ?? null;
    }, [user?.role, user?.superKassir, user?.enterpriseId, selectedEnterpriseId]);

    const refUrl =
        secondReferenceId && token
            ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${secondReferenceId}`
            : null;
    const { data: selectedRef } = useSWR(refUrl, (url) => getDataForSwr(url, token));

    const displayName = useMemo(() => {
        if (!selectedRef) return '';
        return formatTmzLabel(selectedRef.name, selectedRef.article);
    }, [selectedRef]);

    const hasSelection = secondReferenceId != null && secondReferenceId !== undefined;

    const onProductSelected = useCallback(
        (product: Product) => {
            if (!setMainData) return;
            setMainData('reportOption', {
                ...reportOption,
                secondReferenceId: product.id,
            });
        },
        [setMainData, reportOption],
    );

    const { isOpen, openCatalog, closeCatalog, handleSelectProduct } = useProductCatalog({
        onProductSelected: (product, _quantity) => onProductSelected(product),
        currentDocTableItems: [],
    });

    const handleClear = useCallback(() => {
        if (!setMainData) return;
        const { secondReferenceId: _removed, ...rest } = reportOption;
        setMainData('reportOption', { ...rest, secondReferenceId: undefined });
    }, [setMainData, reportOption]);

    const documentDate = reportOption.endDate ?? Date.now();
    const warehouseId = reportOption.firstReferenceId;

    const readoutClasses = [
        pickerStyles.readout,
        hasSelection ? pickerStyles.readoutSelected : '',
        pickerStyles.readoutClickable,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={styles.box}>
            <div className={styles.label}>ТМЗ</div>
            <div className={pickerStyles.row}>
                <div
                    role="button"
                    tabIndex={0}
                    className={readoutClasses}
                    onClick={openCatalog}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openCatalog();
                        }
                    }}
                    title="Каталогдан танлаш"
                >
                    {hasSelection ? displayName || '…' : '— каталогдан танланг —'}
                </div>
                {hasSelection ? (
                    <button
                        type="button"
                        className={pickerStyles.clearBtn}
                        onClick={handleClear}
                        title="Танловни тозалаш"
                    >
                        <XMarkIcon className={pickerStyles.clearBtnIcon} aria-hidden />
                        <span>Очистить</span>
                    </button>
                ) : null}
                <button
                    type="button"
                    className={pickerStyles.catalogBtn}
                    onClick={openCatalog}
                    title="Каталогни очиш"
                    aria-label="Каталогни очиш"
                >
                    <Squares2X2Icon className={pickerStyles.catalogBtnIcon} aria-hidden />
                </button>
            </div>
            <ProductCatalog
                isOpen={isOpen}
                onClose={closeCatalog}
                onSelectProduct={handleSelectProduct}
                typeDocumentByComeOut="come"
                documentType={DocumentType.ComeMaterial}
                documentDate={documentDate}
                referenceEnterpriseId={referenceEnterpriseId}
                warehouseId={warehouseId}
                allowNegativeStock
                catalogMode="pick"
            />
        </div>
    );
}
