import { Suspense } from 'react';
import { CatalogClient, TOOLS_CATALOG_CONFIG } from '../catalog/CatalogClient';
import { getPublicCatalogApiBase } from '../catalog/lib/getApiBase';
import styles from '../catalog/catalog.module.css';
import { fetchPublicToolsCatalog } from './lib/fetchToolsCatalog';

function ToolsCatalogFallback() {
  return (
    <div className={styles.page}>
      <p className={styles.muted}>Юкланмоқда…</p>
    </div>
  );
}

export default async function ToolsCatalogPage() {
  const data = await fetchPublicToolsCatalog();
  const apiBase = getPublicCatalogApiBase();

  return (
    <Suspense fallback={<ToolsCatalogFallback />}>
      <CatalogClient
        initialItems={data.items}
        apiBaseUrl={apiBase}
        config={TOOLS_CATALOG_CONFIG}
      />
    </Suspense>
  );
}
