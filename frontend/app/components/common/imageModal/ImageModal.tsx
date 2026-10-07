'use client'
import React, { memo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImageModal.module.css';

interface ImageModalProps {
  isOpen: boolean;
  /** Массив URL изображений для слайдера */
  images?: string[];
  /** Одиночный URL (для обратной совместимости) */
  imageUrl?: string;
  imageName: string;
  onClose: () => void;
}

export const ImageModal = memo<ImageModalProps>(({
  isOpen,
  images: imagesProp,
  imageUrl,
  imageName,
  onClose
}) => {
  const images = imagesProp ?? (imageUrl ? [imageUrl] : []);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen, images]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', handleKeyDown);
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, images.length]);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(i => Math.min(i + 1, images.length - 1));
  }, [images.length]);

  if (!isOpen || images.length === 0) return null;

  const modalContent = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{imageName}</h3>
          <div className={styles.headerRight}>
            {images.length > 1 && (
              <span className={styles.counter}>{currentIndex + 1} / {images.length}</span>
            )}
            <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.imageContainer}>
          {images.length > 1 && currentIndex > 0 && (
            <button className={styles.navButton} style={{ left: 12 }} onClick={goPrev}>
              &#x276E;
            </button>
          )}

          <img
            src={images[currentIndex]}
            alt={`${imageName} ${currentIndex + 1}`}
            className={styles.image}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM5Q0EzQUYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn"ZSo8L3RleHQ+Cjwvc3ZnPg==';
            }}
          />

          {images.length > 1 && currentIndex < images.length - 1 && (
            <button className={styles.navButton} style={{ right: 12 }} onClick={goNext}>
              &#x276F;
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className={styles.dots}>
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`${styles.dot} ${idx === currentIndex ? styles.dotActive : ''}`}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

ImageModal.displayName = 'ImageModal';
