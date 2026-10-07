import { Schet } from '@/app/interfaces/report.interface';
import { getApiDomain } from '../common/getApiDomain';

export interface StockData {
  totalQuantity: number;
  totalSum: number;
  totalSumUsd: number;
  reservedQuantity: number;
  availableQuantity: number;
  availableSum: number;
  availableSumUsd: number;
  lastUpdate: number;
}

export async function getStockByItem(
  schet: Schet | string,
  warehouseId: number,
  productId: number,
  date?: number,
  enterpriseId?: number,
  token?: string
): Promise<StockData> {
  const API_URL = getApiDomain() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5009');
  
  const params = new URLSearchParams({
    schet: schet.toString(),
    warehouseId: warehouseId.toString(),
    productId: productId.toString(),
  });
  
  if (date) {
    params.append('date', date.toString());
  }
  
  if (enterpriseId) {
    params.append('enterpriseId', enterpriseId.toString());
  }
  
  const response = await fetch(`${API_URL}/api/stocks/by-item?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stock: ${response.statusText}`);
  }
  
  return response.json();
}

