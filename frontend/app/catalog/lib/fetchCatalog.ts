import type { PublicCatalogItemDto } from '../types';
import { getPublicCatalogApiBase } from './getApiBase';

export async function fetchPublicCatalog(): Promise<{
  items: PublicCatalogItemDto[];
}> {
  const base = getPublicCatalogApiBase();
  const url = `${base}/api/public/catalog/tree`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return { items: [] };
    return res.json();
  } catch {
    return { items: [] };
  }
}
