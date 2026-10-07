'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import cn from 'classnames';
import { ImageModal } from '@/app/components/common/imageModal/ImageModal';
import {
  getTmzGalleryImageUrls,
  pickTmzGalleryImagePath,
  resolveTmzProductImageUrl,
  type TmzGalleryRefValues,
} from '@/app/utils/tmzProductImageUrl';
import styles from '../referencesList.module.css';

interface ReferenceImageThumbProps {
  isFolder: boolean;
  refValues?: TmzGalleryRefValues | null;
  alt: string;
}

function BrokenImageIcon() {
  return (
    <svg
      className={styles.brokenImageIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 16l3-3 2 2 3-4 4 5" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export const ReferenceImageThumb = memo<ReferenceImageThumbProps>(
  ({ isFolder, refValues, alt }) => {
    const storedPath = pickTmzGalleryImagePath(refValues);
    const src = storedPath ? resolveTmzProductImageUrl(storedPath) : null;
    const galleryUrls = useMemo(() => getTmzGalleryImageUrls(refValues), [refValues]);
    const [failed, setFailed] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    useEffect(() => {
      setFailed(false);
    }, [storedPath]);

    const handleThumbDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (galleryUrls.length > 0) {
          setIsImageModalOpen(true);
        }
      },
      [galleryUrls.length],
    );

    const thumbTitle =
      galleryUrls.length > 1
        ? `Двойной клик для просмотра (${galleryUrls.length} фото)`
        : 'Двойной клик для просмотра';

    if (isFolder) {
      return (
        <div className={styles.imagePlaceholder} aria-hidden>
          📁
        </div>
      );
    }

    if (!storedPath) {
      return (
        <div className={styles.imagePlaceholder} aria-hidden title="Расм йўқ">
          📦
        </div>
      );
    }

    if (!src || failed) {
      return (
        <div
          className={cn(styles.imagePlaceholder, styles.imagePlaceholderBroken)}
          title="Расм юкланмади"
          aria-label="Расм юкланмади"
        >
          <BrokenImageIcon />
        </div>
      );
    }

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={styles.productImageThumb}
          loading="lazy"
          onError={() => setFailed(true)}
          onDoubleClick={handleThumbDoubleClick}
          title={thumbTitle}
        />
        {galleryUrls.length > 0 && (
          <ImageModal
            isOpen={isImageModalOpen}
            images={galleryUrls}
            imageName={alt}
            onClose={() => setIsImageModalOpen(false)}
          />
        )}
      </>
    );
  },
);

ReferenceImageThumb.displayName = 'ReferenceImageThumb';
