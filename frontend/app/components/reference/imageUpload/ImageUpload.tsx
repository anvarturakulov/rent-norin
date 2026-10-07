import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import cn from 'classnames';
import {
  ArrowUpTrayIcon,
  ClipboardDocumentIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import styles from './ImageUpload.module.css';
import { resolveTmzProductImageUrl } from '@/app/utils/tmzProductImageUrl';
import { ImageModal } from '@/app/components/common/imageModal/ImageModal';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

interface ImageUploadProps {
  currentImage?: string;
  onImageChange: (imagePath: string) => void;
  className?: string;
  disabled?: boolean;
  /** Подпись над блоком (по умолчанию «ТМБ сурати») */
  label?: string;
}

function isJpegType(type: string): boolean {
  return type.includes('jpeg') || type.includes('jpg');
}

function fallbackPasteFile(blob: Blob, type: string): File {
  const ext = isJpegType(type) ? 'jpg' : type.includes('png') ? 'png' : type.split('/')[1] || 'png';
  return new File([blob], `paste-${Date.now()}.${ext}`, { type });
}

async function imageBlobToJpeg(blob: Blob, type: string): Promise<File> {
  if (isJpegType(type)) {
    return new File([blob], `paste-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('canvas context unavailable');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!jpegBlob) {
      throw new Error('toBlob returned null');
    }

    return new File([jpegBlob], `paste-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } catch (error) {
    console.warn('Не удалось конвертировать изображение из буфера в JPEG, используется исходный формат:', error);
    return fallbackPasteFile(blob, type);
  }
}

function fileFromPasteEvent(event: React.ClipboardEvent): File | null {
  for (const item of event.clipboardData.items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

export const ImageUpload = memo<ImageUploadProps>(({
  currentImage,
  onImageChange,
  className,
  disabled = false,
  label = 'ТМБ сурати',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const uploadImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('ТМБ сурати танланг');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      alert('ТМБ сурати узунлиги 2MB дан ортиқ бўлмаслик керак');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/upload/product-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('ТМБ сурати юкланмокда хатолик юз берди');
      }

      const result = await response.json();
      onImageChange(result.imagePath);
    } catch (error) {
      console.error('❌ ТМБ сурати юкланмокда хатолик юз берди:', error);
      alert('ТМБ сурати юкланмокда хатолик юз берди');
      setPreview(currentImage || null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [currentImage, onImageChange]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImageFile(file);
  };

  const openFilePicker = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handlePasteFromClipboard = async () => {
    if (disabled || isUploading) return;

    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const jpegFile = await imageBlobToJpeg(blob, imageType);
            await uploadImageFile(jpegFile);
            return;
          }
        }
      }
      alert('Буферда расм топилмади. Аввал расмни нусхаланг (PrtSc ёки «Расмни нусхалаш»).');
    } catch {
      uploadAreaRef.current?.focus();
      alert('Буферга кириш рухсат берилмади. Буфердан Ctrl+V ишлатинг ёки браузер рухсатини йўқинг.');
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    if (disabled || isUploading) return;
    const file = fileFromPasteEvent(event);
    if (!file) return;
    event.preventDefault();
    void (async () => {
      const jpegFile = await imageBlobToJpeg(file, file.type);
      await uploadImageFile(jpegFile);
    })();
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getImageUrl = (imagePath: string) =>
    resolveTmzProductImageUrl(imagePath) ?? '';

  const getPreviewUrl = useCallback(() => {
    if (!preview) return '';
    return preview.startsWith('data:') ? preview : getImageUrl(preview);
  }, [preview]);

  const handleImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (preview) {
      setIsImageModalOpen(true);
    }
  };

  const handleAreaClick = (e: React.MouseEvent) => {
    if (disabled || isUploading) return;
    if ((e.target as HTMLElement).closest('button')) return;
    uploadAreaRef.current?.focus();
  };

  const actionBusy = isUploading || disabled;

  const iconBtn = (
    label: string,
    onClick: () => void,
    className: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      disabled={actionBusy}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );

  return (
    <div className={cn(styles.container, className)}>
      <label className={styles.label}>{label}</label>

      <div
        ref={uploadAreaRef}
        className={cn(styles.uploadArea, { [styles.uploadAreaDisabled]: disabled })}
        tabIndex={disabled ? -1 : 0}
        onPaste={handlePaste}
        onClick={handleAreaClick}
        role="group"
        aria-label={label}
      >
        {preview ? (
          <div className={styles.imagePreview}>
            <img
              src={preview.startsWith('data:') ? preview : getImageUrl(preview)}
              alt="ТМБ сурати"
              className={styles.image}
              onDoubleClick={handleImageDoubleClick}
              title="Двойной клик для увеличения"
            />
            <div className={styles.imageActions}>
              {iconBtn(
                'Буфердан',
                handlePasteFromClipboard,
                styles.pasteButton,
                <ClipboardDocumentIcon className={styles.actionIcon} aria-hidden />,
              )}
              {iconBtn(
                'Узгартириш',
                openFilePicker,
                styles.changeButton,
                <ArrowUpTrayIcon className={styles.actionIcon} aria-hidden />,
              )}
              {iconBtn(
                'Учириш',
                handleRemoveImage,
                styles.removeButton,
                <TrashIcon className={styles.actionIcon} aria-hidden />,
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(styles.uploadPlaceholder, { [styles.disabled]: disabled })}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <div className={styles.uploadIcon}>📷</div>
            <div className={styles.uploadText}>
              {isUploading ? 'Юкланмокда...' : 'Расм қўшинг'}
            </div>
            <div className={styles.uploadHint}>
              JPEG, PNG, GIF, WebP — 2MB гача
            </div>
            <div className={styles.placeholderActions}>
              {iconBtn(
                'Буфердан',
                handlePasteFromClipboard,
                styles.pasteButton,
                <ClipboardDocumentIcon className={styles.actionIcon} aria-hidden />,
              )}
              {iconBtn(
                'Файлдан',
                openFilePicker,
                styles.fileButton,
                <ArrowUpTrayIcon className={styles.actionIcon} aria-hidden />,
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className={styles.hiddenInput}
          disabled={actionBusy}
        />
      </div>

      <ImageModal
        isOpen={isImageModalOpen}
        imageUrl={getPreviewUrl()}
        imageName={label}
        onClose={() => setIsImageModalOpen(false)}
      />
    </div>
  );
});

ImageUpload.displayName = 'ImageUpload';
