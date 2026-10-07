'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import styles from './TmzReportImageModal.module.css';

export type TmzImageSlots = [string | null, string | null, string | null];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  imageSlots: TmzImageSlots;
};

const SLOT_LABELS = ['1', '2', '3'] as const;

function SlotImage({ filename, baseUrl }: { filename: string; baseUrl: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [filename]);

  if (failed) {
    return <span className={styles.slotPlaceholder} aria-hidden>—</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.slotImg}
      src={`${baseUrl}/api/upload/image/${filename}`}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function TmzReportImageModal({ isOpen, onClose, title, imageSlots }: Props) {
  const [zoomedFilename, setZoomedFilename] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setZoomedFilename(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (zoomedFilename) {
        setZoomedFilename(null);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, zoomedFilename]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const closeZoom = useCallback(() => setZoomedFilename(null), []);

  if (!isOpen || typeof document === 'undefined') return null;

  const base = process.env.NEXT_PUBLIC_DOMAIN || '';

  return createPortal(
    <>
      <div
        className={styles.overlay}
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tmz-report-img-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.head}>
            <h2 id="tmz-report-img-title" className={styles.title}>
              {title}
            </h2>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Ёпиш">
              ×
            </button>
          </div>
          <p className={styles.subtitle}>ТМЗ расмлари</p>
          <div className={styles.grid}>
            {imageSlots.map((filename, i) => (
              <figure key={i} className={styles.slot}>
                <div className={styles.slotFrame}>
                  {filename ? (
                    <button
                      type="button"
                      className={styles.slotOpenBtn}
                      onClick={() => setZoomedFilename(filename)}
                      aria-label={`Катта кўриш: расм ${SLOT_LABELS[i]}`}
                    >
                      <SlotImage filename={filename} baseUrl={base} />
                    </button>
                  ) : (
                    <span className={styles.slotEmpty} aria-hidden>
                      —
                    </span>
                  )}
                </div>
                <figcaption className={styles.caption}>{SLOT_LABELS[i]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      {zoomedFilename ? (
        <div
          className={styles.lightboxOverlay}
          role="presentation"
          onClick={closeZoom}
        >
          <div
            className={styles.lightboxInner}
            role="dialog"
            aria-modal="true"
            aria-label="Катта расм"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.lightboxClose} onClick={closeZoom} aria-label="Ёпиш">
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.lightboxImg}
              src={`${base}/api/upload/image/${zoomedFilename}`}
              alt=""
              draggable={false}
            />
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
