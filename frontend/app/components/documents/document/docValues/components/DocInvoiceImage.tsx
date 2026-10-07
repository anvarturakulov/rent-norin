import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import styles from '../docValues.module.css';
import { useAppContext } from '@/app/context/app.context';

const INVOICE_IMAGE_FIELDS = [
  'invoiceImagePath',
  'invoiceImagePath2',
  'invoiceImagePath3',
] as const;

const MAX_IMAGES = INVOICE_IMAGE_FIELDS.length;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function clipboardItemToFile(blob: Blob, type: string): File {
  const ext = type.includes('jpeg') || type.includes('jpg') ? 'jpg' : 'png';
  return new File([blob], `paste-${Date.now()}.${ext}`, { type });
}

function fileFromPasteEvent(event: React.ClipboardEvent): File | null {
  for (const item of event.clipboardData.items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

const IconAdd = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconPaste = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

export const DocInvoiceImage = memo(() => {
  const isInvoiceImageEnabled = process.env.NEXT_PUBLIC_DOCUMENT_IMAGE_BASIS_ENABLED === 'true';

  if (!isInvoiceImageEnabled) {
    return null;
  }

  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const [isUploading, setIsUploading] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addCardRef = useRef<HTMLDivElement>(null);

  const isReadonly = currentDocument?.isLocked || currentDocument?.docStatus === 'PROVEDEN';

  const getStoredUrl = useCallback((path: string) => {
    if (path.startsWith('data:') || path.startsWith('http')) {
      return path;
    }
    return `${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/doc-image/${path}`;
  }, []);

  const images = useMemo(() => {
    const dv = currentDocument?.docValues;
    return INVOICE_IMAGE_FIELDS
      .map((field) => dv?.[field])
      .filter((path): path is string => Boolean(path));
  }, [currentDocument?.docValues]);

  const saveImages = useCallback(
    (list: string[]) => {
      if (!setMainData || !currentDocument) return;
      setMainData('currentDocument', {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          invoiceImagePath: list[0] || undefined,
          invoiceImagePath2: list[1] || undefined,
          invoiceImagePath3: list[2] || undefined,
        },
      });
    },
    [setMainData, currentDocument],
  );

  const uploadImageFile = useCallback(
    async (file: File) => {
      if (isReadonly || images.length >= MAX_IMAGES) return;

      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения');
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        alert('Размер файла не должен превышать 5MB');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/doc-invoice-image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Накладной расмини йуклашда хатолик юз берди');
        }

        const result = await response.json();
        const newPath = result.imagePath || result.filename;
        if (newPath) {
          saveImages([...images, newPath].slice(0, MAX_IMAGES));
        }
      } catch {
        alert('Накладной расмини йуклашда хатолик юз берди');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [isReadonly, images, saveImages],
  );

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImageFile(file);
  };

  const handlePasteFromClipboard = async () => {
    if (isReadonly || isUploading || images.length >= MAX_IMAGES) return;

    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            await uploadImageFile(clipboardItemToFile(blob, imageType));
            return;
          }
        }
      }
      alert('Буферда расм топилмади. Аввал расмни нусхаланг (PrtSc ёки «Расмни нусхалаш»).');
    } catch {
      addCardRef.current?.focus();
      alert('Буферга кириш рухсат берилмади. Буфердан Ctrl+V ишлатинг ёки браузер рухсатини йўқинг.');
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    if (isReadonly || isUploading || images.length >= MAX_IMAGES) return;
    const file = fileFromPasteEvent(event);
    if (!file) return;
    event.preventDefault();
    void uploadImageFile(file);
  };

  const handleRemove = (index: number) => {
    if (isReadonly) return;
    saveImages(images.filter((_, i) => i !== index));
  };

  const canAddMore = images.length < MAX_IMAGES && !isReadonly;

  return (
    <div className={styles.invoiceImagesRow}>
      {images.map((path, index) => {
        const url = getStoredUrl(path);
        return (
          <div key={`${path}-${index}`} className={styles.invoiceThumbCard}>
            <img
              src={url}
              alt="Накладной расми"
              className={styles.invoiceThumbImg}
              onClick={() => setModalUrl(url)}
            />
            {!isReadonly && (
              <button
                type="button"
                className={styles.invoiceThumbRemove}
                title="Учириш"
                aria-label="Учириш"
                onClick={() => handleRemove(index)}
                disabled={isUploading}
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {(canAddMore || images.length === 0) && (
        <div
          ref={addCardRef}
          className={cn(styles.invoiceAddCard, {
            [styles.invoiceAddCardDisabled]: !canAddMore || isUploading,
          })}
          tabIndex={canAddMore ? 0 : -1}
          title="Файл танлаш (ёки буфердан Ctrl+V)"
          aria-label="Расм қўшиш"
          onPaste={handlePaste}
          onClick={() => canAddMore && !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <span className={styles.invoiceAddSpinner} />
          ) : (
            <IconAdd />
          )}
          {canAddMore && !isUploading && (
            <button
              type="button"
              tabIndex={-1}
              className={styles.invoicePasteBtn}
              title="Буфердан қўйиш"
              aria-label="Буфердан қўйиш"
              onClick={(e) => {
                e.stopPropagation();
                void handlePasteFromClipboard();
              }}
            >
              <IconPaste />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={styles.hiddenInput}
            disabled={!canAddMore || isUploading}
          />
        </div>
      )}

      {modalUrl && (
        <div className={styles.invoiceModalOverlay} onClick={() => setModalUrl(null)}>
          <div className={styles.invoiceModalContent} onClick={(e) => e.stopPropagation()}>
            <img src={modalUrl} alt="Накладной расми" className={styles.invoiceModalImage} />
            <button
              type="button"
              className={styles.invoiceModalClose}
              onClick={() => setModalUrl(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

DocInvoiceImage.displayName = 'DocInvoiceImage';
