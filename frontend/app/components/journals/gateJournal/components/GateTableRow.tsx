'use client'
import React, { memo, useState } from 'react';
import cn from 'classnames';
import styles from '../gateJournal.module.css';

interface GateEvent {
    id: number;
    plateNumber: string;
    eventType: 'income' | 'outcome';
    eventTime: string | number | bigint;
    cameraIp: string;
    vehicleType?: string;
    vehicleColor?: string;
    imagePath?: string;
    plateImagePath?: string;
    gateAction: 'opened' | 'denied' | 'pending';
    denialReason?: string;
    leaveProdDocument?: {
        id: number;
        docNumber?: string;
        docTableItems?: Array<{
            id: number;
            analiticReference?: {
                name: string;
            };
        }>;
    };
}

interface GateTableRowProps {
    item: GateEvent;
    className?: string;
}

const formatDateTime = (ts: string | number | bigint) => {
    const num = typeof ts === 'string' ? parseInt(ts, 10) : Number(ts);
    if (!Number.isFinite(num) || num <= 0) return '';
    return new Date(num).toLocaleString('ru-RU', { 
        dateStyle: 'short', 
        timeStyle: 'medium' 
    });
}

const getActionText = (action: string) => {
    switch (action) {
        case 'opened': return 'Открыто';
        case 'denied': return 'Отказ';
        case 'pending': return 'Ожидание';
        default: return action;
    }
}

const getEventTypeText = (type: string) => {
    switch (type) {
        case 'income': return 'Въезд';
        case 'outcome': return 'Выезд';
        default: return type;
    }
}

const formatProductList = (docTableItems?: Array<{ analiticReference?: { name: string } }>) => {
    if (!docTableItems || docTableItems.length === 0) return '';
    
    const productNames = docTableItems
        .map(item => item.analiticReference?.name)
        .filter(Boolean) as string[];
    
    if (productNames.length === 0) return '';
    
    const maxProducts = 3;
    const displayProducts = productNames.slice(0, maxProducts);
    const hasMore = productNames.length > maxProducts;
    
    return displayProducts.join(', ') + (hasMore ? '...' : '');
};

export const GateTableRow = memo<GateTableRowProps>(({
    item,
    className
}) => {
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showPlatePhotoModal, setShowPlatePhotoModal] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [plateImageError, setPlateImageError] = useState(false);

    const handlePhotoClick = () => {
        if (item.imagePath && !imageError) {
            setShowPhotoModal(true);
        }
    };

    const handlePlatePhotoClick = () => {
        if (item.plateImagePath && !plateImageError) {
            setShowPlatePhotoModal(true);
        }
    };

    const closePhotoModal = () => {
        setShowPhotoModal(false);
    };

    const closePlatePhotoModal = () => {
        setShowPlatePhotoModal(false);
    };

    const handleImageError = () => {
        setImageError(true);
        console.error('Ошибка загрузки изображения:', item.imagePath);
        console.error('Полный URL:', `${process.env.NEXT_PUBLIC_DOMAIN}/${item.imagePath}`);
    };

    const handlePlateImageError = () => {
        setPlateImageError(true);
        console.error('Ошибка загрузки изображения номера:', item.plateImagePath);
        console.error('Полный URL:', `${process.env.NEXT_PUBLIC_DOMAIN}/${item.plateImagePath}`);
    };

    const handleRowDoubleClick = () => {
        if (item.imagePath && !imageError) {
            setShowPhotoModal(true);
        }
    };

    return (
        <>
            <tr 
                className={cn(styles.trRow, className)} 
                onDoubleClick={handleRowDoubleClick}
                title="Двойной клик для просмотра изображения"
                style={{ cursor: item.imagePath && !imageError ? 'pointer' : 'default' }}
            >
                <td className={styles.rowId}>{item.id}</td>
                <td className={styles.rowDate}>{formatDateTime(item.eventTime)}</td>
                <td className={styles.rowPlateNumber}>{item.plateNumber}</td>
                <td className={styles.rowVehicleType}>{item.vehicleType || '-'}</td>
                <td className={cn(styles.rowGateAction, styles[item.gateAction])}>
                    {getActionText(item.gateAction)}
                </td>
                <td className={styles.rowDocument}>
                    {item.leaveProdDocument ? (
                        <>
                            {item.leaveProdDocument.docNumber || `№${item.leaveProdDocument.id}`}
                            {formatProductList(item.leaveProdDocument.docTableItems) && (
                                <>: {formatProductList(item.leaveProdDocument.docTableItems)}</>
                            )}
                        </>
                    ) : '-'}
                </td>
                <td className={styles.rowReason}>{item.denialReason || '-'}</td>
                <td className={styles.rowCameraIp}>{item.cameraIp}</td>
                <td className={styles.rowPhoto}>
                    {item.imagePath && !imageError ? (
                        <img 
                            src={`${process.env.NEXT_PUBLIC_DOMAIN}/${item.imagePath}`} 
                            alt="car" 
                            className={styles.photoThumbnail}
                            onClick={handlePhotoClick}
                            onDoubleClick={handlePhotoClick}
                            onError={handleImageError}
                            title={`Кликните для просмотра изображения\nURL: ${process.env.NEXT_PUBLIC_DOMAIN}/${item.imagePath}`}
                        />
                    ) : item.imagePath && imageError ? (
                        <span 
                            title={`Ошибка загрузки изображения\nURL: ${process.env.NEXT_PUBLIC_DOMAIN}/${item.imagePath}`} 
                            style={{color: 'red', cursor: 'pointer'}}
                        >
                            ❌
                        </span>
                    ) : (
                        <span title="Изображение не найдено">-</span>
                    )}
                </td>
                <td className={styles.rowPlatePhoto}>
                    {item.plateImagePath && !plateImageError ? (
                        <img 
                            src={`${process.env.NEXT_PUBLIC_DOMAIN}/${item.plateImagePath}`} 
                            alt="plate" 
                            className={styles.photoThumbnail}
                            onClick={handlePlatePhotoClick}
                            onDoubleClick={handlePlatePhotoClick}
                            onError={handlePlateImageError}
                            title={`Кликните для просмотра изображения номера\nURL: ${process.env.NEXT_PUBLIC_DOMAIN}/${item.plateImagePath}`}
                        />
                    ) : item.plateImagePath && plateImageError ? (
                        <span 
                            title={`Ошибка загрузки изображения номера\nURL: ${process.env.NEXT_PUBLIC_DOMAIN}/${item.plateImagePath}`} 
                            style={{color: 'red', cursor: 'pointer'}}
                        >
                            ❌
                        </span>
                    ) : (
                        <span title="Изображение номера не найдено">-</span>
                    )}
                </td>
            </tr>

            {showPhotoModal && item.imagePath && !imageError && (
                <div className={styles.photoModal} onClick={closePhotoModal}>
                    <span className={styles.photoModalClose} onClick={closePhotoModal}>&times;</span>
                    <img 
                        src={`${process.env.NEXT_PUBLIC_DOMAIN}/${item.imagePath}`} 
                        alt="car" 
                        onClick={(e) => e.stopPropagation()}
                        onError={handleImageError}
                    />
                </div>
            )}

            {showPlatePhotoModal && item.plateImagePath && !plateImageError && (
                <div className={styles.photoModal} onClick={closePlatePhotoModal}>
                    <span className={styles.photoModalClose} onClick={closePlatePhotoModal}>&times;</span>
                    <img 
                        src={`${process.env.NEXT_PUBLIC_DOMAIN}/${item.plateImagePath}`} 
                        alt="plate" 
                        onClick={(e) => e.stopPropagation()}
                        onError={handlePlateImageError}
                    />
                </div>
            )}
        </>
    );
});

GateTableRow.displayName = 'GateTableRow';
