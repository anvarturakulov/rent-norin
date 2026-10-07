import { Suspense } from 'react';
import { fetchPublicCatalog } from './lib/fetchCatalog';
import { getPublicCatalogApiBase } from './lib/getApiBase';
import { CatalogClient, PRODUCT_CATALOG_CONFIG } from './CatalogClient';
import styles from './catalog.module.css';

function CatalogFallback() {
  return (
    <div className={styles.page}>
      <p className={styles.muted}>Юкланмоқда…</p>
    </div>
  );
}

export default async function CatalogPage() {
  const data = await fetchPublicCatalog();
  const apiBase = getPublicCatalogApiBase();

  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogClient
        initialItems={data.items}
        apiBaseUrl={apiBase}
        config={PRODUCT_CATALOG_CONFIG}
      />
    </Suspense>
  );
}
