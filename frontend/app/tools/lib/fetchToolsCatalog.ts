import type { PublicCatalogItemDto } from '../../catalog/types';
import { getPublicCatalogApiBase } from '../../catalog/lib/getApiBase';

export async function fetchPublicToolsCatalog(): Promise<{
  items: PublicCatalogItemDto[];
}> {
  const base = getPublicCatalogApiBase();
  const url = `${base}/api/public/catalog/tools/tree`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return { items: [] };
    return res.json();
  } catch {
    return { items: [] };
  }
}
