'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import cn from 'classnames';
import type { PublicCatalogItemDto } from './types';
import styles from './catalog.module.css';

function imageUrl(apiBase: string, filename: string) {
  return `${apiBase}/api/upload/image/${encodeURIComponent(filename)}`;
}

function formatPrice(n: number): string {
  return Number(n).toLocaleString('ru-RU');
}

function isUnderCategory(
  product: PublicCatalogItemDto,
  categoryId: number | null,
  all: PublicCatalogItemDto[],
): boolean {
  if (categoryId === null) return true;
  let pid: number | null | undefined = product.parentId;
  while (pid != null) {
    if (pid === categoryId) return true;
    const parent = all.find((i) => i.id === pid);
    pid = parent?.parentId ?? null;
  }
  return false;
}

export type CatalogPriceMode = 'retail' | 'rental';

export type CatalogClientConfig = {
  brandSubtitle: string;
  brandCatalog: string;
  heroText: string;
  emptyMessage: string;
  itemsSectionTitle: string;
  priceMode: CatalogPriceMode;
};

type Props = {
  initialItems: PublicCatalogItemDto[];
  apiBaseUrl: string;
  config: CatalogClientConfig;
};

function TilePrices({ item, priceMode }: { item: PublicCatalogItemDto; priceMode: CatalogPriceMode }) {
  if (priceMode === 'rental') {
    return (
      <>
        {item.hourlyPrice != null ? (
          <p className={styles.tileMeta}>{formatPrice(item.hourlyPrice)} сўм/соат</p>
        ) : null}
        {item.dailyPrice != null ? (
          <p className={styles.tileMeta}>{formatPrice(item.dailyPrice)} сўм/кун</p>
        ) : null}
      </>
    );
  }
  if (item.displayPrice != null) {
    return <p className={styles.tileMeta}>{formatPrice(item.displayPrice)} сўм</p>;
  }
  return null;
}

function ModalPrices({ item, priceMode }: { item: PublicCatalogItemDto; priceMode: CatalogPriceMode }) {
  if (priceMode === 'rental') {
    return (
      <>
        {item.hourlyPrice != null ? (
          <p className={styles.price}>{formatPrice(item.hourlyPrice)} сўм/соат</p>
        ) : null}
        {item.dailyPrice != null ? (
          <p className={styles.price}>{formatPrice(item.dailyPrice)} сўм/кун</p>
        ) : null}
      </>
    );
  }
  if (item.displayPrice != null) {
    return <p className={styles.price}>{formatPrice(item.displayPrice)} сўм</p>;
  }
  return null;
}

export function CatalogClient({ initialItems, apiBaseUrl, config }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PublicCatalogItemDto | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const folders = useMemo(
    () => initialItems.filter((i) => i.isFolder).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [initialItems],
  );

  const products = useMemo(
    () => initialItems.filter((i) => !i.isFolder),
    [initialItems],
  );

  const visibleProducts = useMemo(
    () => products.filter((p) => isUnderCategory(p, categoryId, initialItems)),
    [products, categoryId, initialItems],
  );

  const openProduct = useCallback(
    (p: PublicCatalogItemDto) => {
      setSelected(p);
      setImgIndex(0);
      const q = new URLSearchParams(searchParams.toString());
      q.set('product', String(p.id));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeModal = useCallback(() => {
    setSelected(null);
    const q = new URLSearchParams(searchParams.toString());
    q.delete('product');
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const raw = searchParams.get('product');
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(id)) {
      setSelected(null);
      return;
    }
    const p = products.find((x) => x.id === id);
    if (p) {
      setSelected(p);
      setImgIndex(0);
    }
  }, [searchParams, products]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  useEffect(() => {
    if (selected) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected]);

  useEffect(() => {
    setImgIndex(0);
  }, [selected?.id]);

  const images = selected?.images?.length ? selected.images : [];
  const mainFile = images[imgIndex];

  return (
    <div className={styles.page}>
      <div className={styles.topStrip}>
        <div className={styles.topInner}>
          <div className={styles.brandBlock}>
            <p className={styles.brandMebers}>MEBERS</p>
            <p className={styles.brandSub}>{config.brandSubtitle}</p>
            <p className={styles.brandCatalog}>{config.brandCatalog}</p>
          </div>
        </div>
      </div>

      <header className={styles.hero}>
        <p>{config.heroText}</p>
      </header>

      <div className={styles.shell}>
        <div className={styles.card}>
          {initialItems.length === 0 ? (
            <p className={styles.muted}>{config.emptyMessage}</p>
          ) : (
            <>
              <p className={styles.sectionTitle}>Гуруҳлар</p>
              <div className={styles.chips}>
                <button
                  type="button"
                  className={cn(styles.chip, categoryId === null && styles.chipActive)}
                  onClick={() => setCategoryId(null)}
                >
                  Барчаси
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(styles.chip, categoryId === f.id && styles.chipActive)}
                    onClick={() => setCategoryId(f.id)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              <p className={styles.sectionTitle} style={{ marginTop: '1.25rem' }}>
                {config.itemsSectionTitle} ({visibleProducts.length})
              </p>
              <div className={styles.grid}>
                {visibleProducts.map((p) => {
                  const first = p.images[0];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.tile}
                      onClick={() => openProduct(p)}
                    >
                      <div className={styles.thumbWrap}>
                        {first ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className={styles.thumb}
                            src={imageUrl(apiBaseUrl, first)}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.thumbPlaceholder}>
                            {config.priceMode === 'rental' ? '🔧' : '📦'}
                          </div>
                        )}
                      </div>
                      <div className={styles.tileBody}>
                        <h3 className={styles.tileTitle}>{p.name}</h3>
                        {p.article ? (
                          <p className={styles.tileMeta}>Артикул: {p.article}</p>
                        ) : null}
                        <TilePrices item={p} priceMode={config.priceMode} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title">
            <div className={styles.modalHead}>
              <h2 id="catalog-modal-title" className={styles.modalTitle}>
                {selected.name}
              </h2>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Ёпиш">
                ×
              </button>
            </div>

            <div className={styles.modalGallery}>
              {mainFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.modalMainImg} src={imageUrl(apiBaseUrl, mainFile)} alt="" />
              ) : (
                <div
                  className={styles.modalMainImg}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '1rem',
                  }}
                >
                  Расм йўқ
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className={cn(styles.galleryNav, styles.galleryPrev)}
                    disabled={imgIndex <= 0}
                    onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                    aria-label="Олдинги расм"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={cn(styles.galleryNav, styles.galleryNext)}
                    disabled={imgIndex >= images.length - 1}
                    onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                    aria-label="Кейинги расм"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className={styles.thumbStrip}>
                {images.map((fn, i) => (
                  <button
                    key={fn}
                    type="button"
                    className={cn(styles.miniThumb, i === imgIndex && styles.miniActive)}
                    onClick={() => setImgIndex(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(apiBaseUrl, fn)} alt="" />
                  </button>
                ))}
              </div>
            )}

            <div className={styles.modalBody}>
              {selected.article ? (
                <p className={styles.tileMeta}>Артикул: {selected.article}</p>
              ) : null}
              {selected.unit ? <p className={styles.tileMeta}>Ўлчов бирлиги: {selected.unit}</p> : null}
              <ModalPrices item={selected} priceMode={config.priceMode} />
              {selected.websiteDescription ? (
                <p className={styles.desc}>{selected.websiteDescription}</p>
              ) : (
                <p className={styles.muted} style={{ padding: 0, textAlign: 'left' }}>
                  Тавсиф қўшилмаган.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const PRODUCT_CATALOG_CONFIG: CatalogClientConfig = {
  brandSubtitle: 'Мебел ишлаб чикариш корхонаси',
  brandCatalog: 'КАТАЛОГ',
  heroText: 'Танланг: гуруҳ бўйича фильтрланг, карточкани босиб деталларни кўринг.',
  emptyMessage:
    'Каталог бўш. Админда ТМЗ (готовая продукция) учун «Каталогда сайтда кўрсатиш»ни ёқинг ва серверда PUBLIC_CATALOG_ENTERPRISE_ID тўғри enterprise ID (ёки null) эканини текширинг.',
  itemsSectionTitle: 'Маҳсулотлар',
  priceMode: 'retail',
};

export const TOOLS_CATALOG_CONFIG: CatalogClientConfig = {
  brandSubtitle: 'Ускуна ижараси',
  brandCatalog: 'УСКУНА',
  heroText: 'Ижара учун ускунани танланг: гуруҳ бўйича фильтрланг, карточкани босиб деталларни кўринг.',
  emptyMessage:
    'Каталог бўш. Админда ТМЗ (ускуна) учун «Сайтда кўрсатиш»ни ёқинг ва серверда PUBLIC_TOOLS_CATALOG_ENTERPRISE_ID тўғри enterprise ID (ёки null) эканини текширинг.',
  itemsSectionTitle: 'Ускуна',
  priceMode: 'rental',
};
