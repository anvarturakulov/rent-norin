'use client'
import React, { memo, useRef } from 'react';
import cn from 'classnames';
import { DocumentModel, DocSTATUS } from '@/app/interfaces/document.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { secondsToDateString } from '../../../documents/document/doc/helpers/doc.functions';
import { getNameReference } from '../helpers/journal.functions';
import { getUserName } from '../helpers/journal.functions';
import IcoTrash from '../ico/trash.svg';
import styles from '../journal.module.css';
import { Maindata } from '@/app/context/app.context.interfaces';
import { isDocumentDateBanned } from '@/app/service/settings/dateBanEditing';

interface GateIncomeTableRowProps {
    item: DocumentModel;
    references: any;
    mainData: any;
    token: string | undefined;
    setMainData: Function | undefined;
    isDisabled: boolean;
    setIsDisabled: (disabled: boolean) => void;
    deleteItemDocument: (id: number | undefined, date: number | undefined, token: string | undefined, setMainData: Function | undefined, mainData: any, setIsDisabled: (disabled: boolean) => void) => void;
    getDocument: (id: number | undefined, setMainData: Function | undefined, token: string | undefined, mainData?: Maindata, currentContentName?: string) => void;
    className?: string;
}

export const GateIncomeTableRow = memo<GateIncomeTableRowProps>(({
    item,
    references,
    mainData,
    token,
    setMainData,
    isDisabled,
    setIsDisabled,
    deleteItemDocument,
    getDocument,
    className
}) => {
    const lastTapRef = useRef<number>(0);

    // Обработчик для touch-устройств (двойное касание)
    const handleTouchStart = (e: React.TouchEvent) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapRef.current;
        
        if (tapLength < 500 && tapLength > 0) {
            // Двойное касание обнаружено
            e.preventDefault();
            getDocument(item.id, setMainData, token);
        }
        
        lastTapRef.current = currentTime;
    };

    const handleTrashClick = () => {
        // Для GateIncome используем стандартную логику удаления
        deleteItemDocument(item.id, item.date, token, setMainData, mainData, setIsDisabled);
    };

    // Определяем, показывать ли кнопку удаления
    const user = mainData?.users?.user;
    const userEnterpriseId = user?.enterpriseId;
    
    // Кнопка Trash показывается для всех документов, кроме проведенных и заблокированных
    const showTrashButton =
        !isDocumentDateBanned(item.date, mainData?.settings?.dateBanEditing) &&
        (!(item.docStatus === DocSTATUS.PROVEDEN && item.isLocked) || user?.role === UserRoles.ADMINGLOBAL);

    // Получаем модель автомобиля из references
    const getCarModel = (carId: number | undefined): string => {
        if (!carId || !references || references.length === 0) return '-';
        const carReference = references.find((ref: any) => ref.id === carId);
        return carReference?.refValues?.carModel || '-';
    };

    return (
        <tr 
            className={cn(className)}
            onDoubleClick={() => {getDocument(item.id, setMainData, token)}}
            onTouchStart={handleTouchStart}
        >
            <td className={cn(styles.rowId)}>{item.id}</td>
            <td className={cn(styles.rowDate,{ 
                    [styles.proveden]: item.docStatus == DocSTATUS.PROVEDEN,
                    [styles.deleted]: item.docStatus == DocSTATUS.DELETED,  
                    [styles.open]: item.docStatus == DocSTATUS.OPEN,
                    [styles.pending]: item.docStatus == DocSTATUS.PENDING,
                    [styles.rejected]: item.docStatus == DocSTATUS.REJECTED
            }    
            )}>{secondsToDateString(item.date)}</td>
            <td className={cn(styles.longRow)}>
                {getNameReference(references, item.docValues?.carId)}
            </td>
            <td className={cn(styles.longRow)}>
                {getCarModel(item.docValues?.carId)}
            </td>
            <td className={cn(styles.longRow)}>
                {item.docValues?.comment || '-'}
            </td>
            <td className={cn(styles.rowDate, {
                [styles.proveden]: item.docStatus == DocSTATUS.PROVEDEN,
                [styles.open]: item.docStatus == DocSTATUS.OPEN,
            })}>
                {item.docStatus === DocSTATUS.PROVEDEN ? 'Проведен' : 
                 item.docStatus === DocSTATUS.OPEN ? 'Открыт' : 
                 item.docStatus === DocSTATUS.PENDING ? 'Ожидает' :
                 item.docStatus === DocSTATUS.REJECTED ? 'Отклонен' :
                 item.docStatus === DocSTATUS.DELETED ? 'Удален' : '-'}
            </td>
            <td>{getUserName(item.userId, mainData)}</td>
            <td className={styles.rowAction}>
                {showTrashButton && (
                    <IcoTrash 
                        className={cn(styles.icoTrash, {
                            [styles.disabled]: isDisabled
                        })}
                        onClick={handleTrashClick}
                    />
                )}
            </td>
        </tr>
    );
});

GateIncomeTableRow.displayName = 'GateIncomeTableRow';

