import axios from 'axios';

export type SupplierGoodsRow = {
  docId: string;
  date: number;
  itemId: number;
  itemName: string;
  article: string;
  typeTMZ: string;
  unit: string;
  count: number;
  price: number;
  total: number;
};

export type SupplierGoodsTotals = {
  documentsCount: number;
  operationsCount: number;
  totalCount: number;
  totalSum: number;
};

export type SupplierGoodsResponse = {
  reportType: 'SUPPLIER_GOODS';
  values: {
    supplierId: number | null;
    supplierName: string;
    periodStart: number | null;
    periodEnd: number | null;
    items: SupplierGoodsRow[];
    totals: SupplierGoodsTotals;
  };
};

export const getSupplierGoodsInform = async (
  supplierId: number,
  startDate: number,
  endDate: number,
  selectedEnterpriseId: unknown,
  token: string,
): Promise<SupplierGoodsResponse> => {
  const config = { headers: { Authorization: `Bearer ${token}` } };

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/supplierGoods' +
    '?startDate=' +
    startDate +
    '&endDate=' +
    endDate +
    '&sectionId=' +
    supplierId;

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number })?.id
        : selectedEnterpriseId;

    if (typeof enterpriseId === 'number') {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  const response = await axios.get(url, config);
  return response.data;
};
