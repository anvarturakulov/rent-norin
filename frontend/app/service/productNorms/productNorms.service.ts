import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

const BASE = () => withApiDomain('/api');

const headers = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...getNgrokBypassHeaders(),
});

export type ProductNormWorkApi = {
    id?: number;
    lineIndex?: number;
    workName: string;
    workArticle?: string;
    unit?: string;
    countInUnit?: number;
    countInOrder?: number;
    timeInUnit?: number;
    timeInOrder?: number;
    salaryInUnit?: number;
    salaryInOrder?: number;
    assignedDeptId?: number;
    workRefId?: number;
    salaryRate?: number;
    hourRate?: number;
};

export type ProductNormMaterialApi = {
    id?: number;
    lineIndex?: number;
    materialId: number;
    price?: number;
    countPlanned?: number;
    total?: number;
};

export type ProductNormHalfstuffApi = {
    id?: number;
    lineIndex?: number;
    halfstuffId: number;
    price?: number;
    countPlanned?: number;
    total?: number;
};

export type ProductNormRouteApi = {
    id?: number;
    sequence: number;
    deptId: number;
};

export type ProductNormComponentApi = {
    id?: number;
    componentReferenceId: number;
    qty: number;
};

export type ProductNormCommonWorkApi = {
    id?: number;
    lineIndex?: number;
    commonWorkRefId?: number;
    workName: string;
    unit?: string;
    quantity?: number;
    price?: number;
    amount?: number;
    selected?: boolean;
};

export type ProductNormsBundle = {
    works: ProductNormWorkApi[];
    commonWorks: ProductNormCommonWorkApi[];
    materials: ProductNormMaterialApi[];
    halfstuffs: ProductNormHalfstuffApi[];
    routes: ProductNormRouteApi[];
    components: ProductNormComponentApi[];
};

export type ResolvedProductNorms = {
    works: Array<
        ProductNormWorkApi & {
            sourceNormId?: number;
        }
    >;
    materials: Array<
        ProductNormMaterialApi & {
            sourceNormId?: number;
        }
    >;
    halfstuffs: Array<
        ProductNormHalfstuffApi & {
            sourceNormId?: number;
        }
    >;
    routes: Array<
        ProductNormRouteApi & {
            sourceRouteId?: number;
        }
    >;
    usesComponents: boolean;
};

export type ReplaceProductNormsPayload = {
    works?: Array<
        Omit<ProductNormWorkApi, 'id'> & {
            lineIndex?: number;
        }
    >;
    commonWorks?: Array<
        Omit<ProductNormCommonWorkApi, 'id'> & {
            lineIndex?: number;
        }
    >;
    materials?: Array<
        Omit<ProductNormMaterialApi, 'id'> & {
            lineIndex?: number;
        }
    >;
    halfstuffs?: Array<
        Omit<ProductNormHalfstuffApi, 'id'> & {
            lineIndex?: number;
        }
    >;
    routes?: ProductNormRouteApi[];
    components?: Array<{ componentReferenceId: number; qty: number }>;
};

export type ProductNormPricing = {
    worksSum: number;
    materialsSum: number;
    halfstuffsSum: number;
    /** сумма работ + материалов + полуфабрикатов */
    subtotal: number;
    firstPrice: number;
    secondPrice: number;
    thirdPrice: number;
    /** то же, что firstPrice */
    wholesalePrice: number;
    usesComponents: boolean;
};

export const productNormsApi = {
    getBundle: async (token: string, referenceId: number): Promise<ProductNormsBundle> => {
        const res = await fetch(`${BASE()}/product-norms/${referenceId}`, { headers: headers(token) });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка загрузки норм изделия');
        }
        return res.json();
    },

    getResolved: async (token: string, referenceId: number): Promise<ResolvedProductNorms> => {
        const res = await fetch(`${BASE()}/product-norms/${referenceId}/resolved`, { headers: headers(token) });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка расчёта норм изделия');
        }
        return res.json();
    },

    replaceAll: async (
        token: string,
        referenceId: number,
        payload: ReplaceProductNormsPayload,
    ): Promise<ProductNormsBundle> => {
        const res = await fetch(`${BASE()}/product-norms/${referenceId}`, {
            method: 'PUT',
            headers: headers(token),
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка сохранения норм изделия');
        }
        return res.json();
    },

    getPricing: async (token: string, referenceId: number): Promise<ProductNormPricing> => {
        const res = await fetch(`${BASE()}/product-norms/${referenceId}/pricing`, { headers: headers(token) });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка расчета ценообразования');
        }
        return res.json();
    },

    applyPricingToCard: async (
        token: string,
        referenceId: number,
    ): Promise<ProductNormPricing & { updated: boolean; firstPrice?: number }> => {
        const res = await fetch(`${BASE()}/product-norms/${referenceId}/pricing/apply`, {
            method: 'POST',
            headers: headers(token),
            body: JSON.stringify({ writeToFirstPrice: true }),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Ошибка записи цены в карточку');
        }
        return res.json();
    },

    uploadReferenceFile: async (
        token: string,
        file: File,
        options?: { referenceId?: number; kind?: 'SCALING' | 'DRAWING' },
    ): Promise<{ url: string; filename: string }> => {
        const fd = new FormData();
        fd.append('file', file);
        if (options?.referenceId != null) fd.append('referenceId', String(options.referenceId));
        if (options?.kind) fd.append('kind', options.kind);
        const res = await fetch(`${BASE()}/upload/tmz-product-file`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                ...getNgrokBypassHeaders(),
            },
            body: fd,
        });
        if (!res.ok) throw new Error('Ошибка загрузки файла');
        return res.json();
    },
};
