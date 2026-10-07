'use client'
import React, { memo, useRef, useEffect, useState } from 'react';
import cn from 'classnames';
import { DocumentModel, DocSTATUS } from '@/app/interfaces/document.interface';
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { secondsToDateString } from '../../../documents/document/doc/helpers/doc.functions';
import { formatDisplayDate, formatDisplayTime } from '@/app/utils/formatDisplayDate';
import { documentTotal, totals } from '../helpers/journal.utils';
import { getNameReference, getNameEnterprise } from '../helpers/journal.functions';
import { getUserName } from '../helpers/journal.functions';
import IcoTrash from '../ico/trash.svg';
import IcoSave from '../ico/save.svg';
import styles from '../journal.module.css';
import { Check } from './check/check';
import IcoPrint from '../ico/print.svg';
import IcoDuplicate from '../ico/copy.svg';
import { openDuplicateDocumentDraft } from '@/app/service/documents/openDuplicateDocumentDraft';
import { isDocumentWithAnalitic } from '@/app/service/documents/isDocumentWithAnalitic';
import { advancePhaseLabel } from '@/app/service/documents/advanceLines';
import { Maindata } from '@/app/context/app.context.interfaces';
import { numberValue } from '@/app/service/common/converters';
import { deleteDocumentPermanent } from '@/app/service/documents/deleteDocumentPermanent';
import { 
  sendInterEnterpriseDocument, 
  cancelSendingInterEnterpriseDocument,
  acceptInterEnterpriseDocument,
  rejectInterEnterpriseDocument,
  returnInterEnterpriseDocumentToWork,
  cancelInterEnterpriseProvodka,
  approveInternalDocument,
  sendInternalDocumentToPending,
} from '@/app/service/documents/interEnterpriseActions';
import { UserRoles } from '@/app/interfaces/user.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { canZavskladEditDocument } from '@/app/service/common/users';
import { FurnitureOrder } from '@/app/interfaces/furnitureOrder.interface';
import {
    formatOrderJournalLabel,
    showsOrderInJournal,
} from '../helpers/orderJournal';
import {
    getToolsRentalAmountsLines,
    showsToolsRentalInJournal,
} from '../helpers/toolsRentalJournal';
import { isDocumentDateBanned } from '@/app/service/settings/dateBanEditing';

interface TableRowProps {
    item: DocumentModel;
    references: any;
    enterprises: any;
    mainData: any;
    token: string | undefined;
    setMainData: Function | undefined;
    isDisabled: boolean;
    setIsDisabled: (disabled: boolean) => void;
    deleteItemDocument: (id: number | undefined, date: number | undefined, token: string | undefined, setMainData: Function | undefined, mainData: any, setIsDisabled: (disabled: boolean) => void) => void;
    setProvodkaToDoc: (id: number | undefined, docDate: number | undefined, token: string | undefined, docStatus: DocSTATUS, setMainData: Function | undefined, mainData: any, receiverId: number | undefined, senderId: number | undefined, setIsDisabled: (disabled: boolean) => void) => void;
    getDocument: (id: number | undefined, setMainData: Function | undefined, token: string | undefined, mainData?: Maindata, currentContentName?: string) => void;
    className?: string;
    contentName?: string;
    isLastActed?: boolean;
    ordersById?: Map<number, FurnitureOrder>;
}

export const TableRow = memo<TableRowProps>(({
    item,
    references,
    enterprises,
    mainData,
    token,
    setMainData,
    isDisabled,
    setIsDisabled,
    deleteItemDocument,
    setProvodkaToDoc,
    getDocument,
    className,
    contentName,
    isLastActed,
    ordersById,
}) => {
    const showOrderColumn = showsOrderInJournal(contentName || '');
    const showToolsRentalColumns = showsToolsRentalInJournal(contentName || '');
    const toolsRentalAmountsLines = showToolsRentalColumns
        ? getToolsRentalAmountsLines(item)
        : [];
    const productForChargeName = getNameReference(references, item.docValues?.productForChargeId);
    const lastTapRef = useRef<number>(0);
    const [showCheck, setShowCheck] = useState<boolean>(false);

    const immediateProvodka =
        (mainData?.settings?.singleEnterpriseMode ?? false) ||
        (mainData?.settings?.avtoProvodkaInManyEnterpriseMode ?? false);

    // Обработчик для touch-устройств (двойное касание)
    const handleTouchStart = (e: React.TouchEvent) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapRef.current;
        
        if (tapLength < 500 && tapLength > 0) {
            // Двойное касание обнаружено
            e.preventDefault();
            getDocument(item.id, setMainData, token, mainData, contentName);
        }
        
        lastTapRef.current = currentTime;
    };

    const canPrintCheck = item.docTableItems && item.docTableItems.length > 0;

    // Определяем логику кнопок в зависимости от типа документа и статуса
    const handleTrashClick = (e: React.MouseEvent<SVGElement>) => {
        // Ctrl+клик: полное удаление только для внутренних DELETED
        if (e.ctrlKey) {
            if (item.isInterEnterprise) {
                alert('Фақат ички ҳужжатни тўлиқ ўчириш мумкин');
                return;
            }
            if (item.docStatus !== DocSTATUS.DELETED) {
                alert('Тўлиқ ўчиришдан олдин ҳужжатни ўчиришга белгиланг');
                return;
            }
            if (confirm('Ҳужжатни базадан тўлиқ ўчиришни хохлайсизми?')) {
                void deleteDocumentPermanent(item.id, token, setMainData);
            }
            return;
        }

        if (item.isInterEnterprise) {
            const user = mainData?.users?.user;
            const userEnterpriseId = user?.enterpriseId;
            
            if (item.docStatus === DocSTATUS.PENDING) {
                const isSender = item.sourceEnterpriseId === userEnterpriseId;
                const isReceiver = item.targetEnterpriseId === userEnterpriseId;
                const isHeadGlobal = user?.role === UserRoles.HEADGLOBAL;
                
                // Если PENDING и это отправитель или HEADGLOBAL - отменить отправку
                if (isSender || isHeadGlobal) {
                    if (confirm('Жўнатишни бекор килишни хохлайсизми?')) {
                        cancelSendingInterEnterpriseDocument(item.id, setMainData, mainData);
                    }
                } 
                // Если PENDING и это получатель (но не HEADGLOBAL) - отклонить
                else if (isReceiver) {
                    const reason = prompt('Рад этиш сабабини киритинг:');
                    if (reason) {
                        rejectInterEnterpriseDocument(item.id, reason, setMainData, mainData);
                    }
                }
            } else if (item.docStatus === DocSTATUS.REJECTED) {
                // Если REJECTED и это отправитель - вернуть в работу
                if (item.sourceEnterpriseId === userEnterpriseId) {
                    if (confirm('Хужжатни ишга кайтаришни хохлайсизми?')) {
                        returnInterEnterpriseDocumentToWork(item.id, setMainData, mainData);
                    }
                }
            } else if (item.docStatus === DocSTATUS.PROVEDEN) {
                if (user?.role === UserRoles.ADMINGLOBAL) {
                    if (confirm('Проводкани бекор килишни хохлайсизми? Барча проводкалар, stocks ва oborots бекор килинади.')) {
                        cancelInterEnterpriseProvodka(item.id, setMainData, mainData);
                    }
                } else {
                    alert('Проведенные межпредприятийные документы удалить нельзя');
                }
            } else {
                // Для других статусов используем стандартную логику
                deleteItemDocument(item.id, item.date, token, setMainData, mainData, setIsDisabled);
            }
        } else {
            // Для обычных документов используем стандартную логику
            deleteItemDocument(item.id, item.date, token, setMainData, mainData, setIsDisabled);
        }
    };

    const handleSaveClick = () => {
        if (isDisabled) return;
        if (item.isInterEnterprise) {
            const user = mainData?.users?.user;
            const userEnterpriseId = user?.enterpriseId;
            
            if (item.docStatus === DocSTATUS.PENDING) {
                // Если PENDING и это получатель - принять документ
                if (item.targetEnterpriseId === userEnterpriseId) {
                    if (confirm('Хужжатни кабул килишни хохлайсизми? Проводка автомат равишда берилади.')) {
                        acceptInterEnterpriseDocument(item.id, setMainData, mainData);
                    }
                } else if (user?.role === UserRoles.HEADGLOBAL) {
                    // HEADGLOBAL может принимать документы от имени других организаций
                    if (confirm('Хужжатни кабул килишни хохлайсизми? Проводка автомат равишда берилади.')) {
                        acceptInterEnterpriseDocument(item.id, setMainData, mainData, item.targetEnterpriseId);
                    }
                } else {
                    alert('Сиз бу хужжатни кабул кила олмайсиз');
                }
            } else if (item.docStatus === DocSTATUS.OPEN) {
                // Если OPEN и это отправитель - отправить документ
                if (item.sourceEnterpriseId === userEnterpriseId) {
                    if (confirm('Хужжатни жўнатишни хохлайсизми?')) {
                        sendInterEnterpriseDocument(item.id, setMainData, mainData);
                    }
                } else {
                    alert('Сиз бу хужжатни жўната олмайсиз');
                }
            } else {
                alert('Хужжат холати макул эмас');
            }
        } else {
            // Для обычных (внутренних) документов:
            // - если статус OPEN: старая логика проведения через setProvodkaToDoc
            //   ИСКЛЮЧЕНИЕ: если документ должен быть PENDING (не GateIncome, не ComeProduct),
            //   то для OPEN документов не проводим сразу, а показываем сообщение
            // - если статус PENDING и роль HEADGLOBAL: утверждение с автоматической проводкой
            // - для MoveCash с hasBuxgalter === true: получатель утверждает через setProvodkaToDoc
            // - иначе показываем сообщение
            const user = mainData?.users?.user;
            const receiverId = item.docValues?.receiverId;
            const receiverReference = references?.find((ref: any) => ref.id === receiverId);
            // Явная проверка существования receiverReference перед проверкой hasBuxgalter
            const receiverHasBuxgalter = receiverReference ? receiverReference.refValues?.hasBuxgalter === true : false;
            const isMoveCash = item.documentType === DocumentType.MoveCash;
            const isReceiverForBuxgalter = isMoveCash && 
                                          receiverHasBuxgalter && 
                                          item.docStatus === DocSTATUS.PENDING &&
                                          receiverId &&
                                          user?.enterpriseId &&
                                          receiverReference?.enterpriseId === user?.enterpriseId;

            // Проверяем, должен ли документ быть PENDING (внутренний, не GateIncome, не ComeProduct/ComeMaterial)
            const docsForNoProveden: Array<string> = [];
            const shouldBePending = item.documentType !== DocumentType.GateIncome &&
                                   !docsForNoProveden.includes(item.documentType) &&
                                   item.documentType !== DocumentType.ComeProduct &&
                                   item.documentType !== DocumentType.ComeMaterial &&
                                   item.documentType !== DocumentType.ComeTools &&
                                   item.documentType !== DocumentType.ComeTovar;

            if (item.docStatus === DocSTATUS.OPEN) {
                // При единственной организации или AVTO_PROVODKA проводим сразу; иначе при shouldBePending — в PENDING для HEADGLOBAL
                const conductNow = !shouldBePending || immediateProvodka;
                if (conductNow) {
                    setProvodkaToDoc(
                      item.id,
                      item.date,
                      token,
                      item.docStatus,
                      setMainData,
                      mainData,
                      item.docValues?.receiverId,
                      item.docValues?.senderId,
                      setIsDisabled
                    );
                } else {
                    if (confirm('Хужжатни тасдиқлаш учун жўнатишни хохлайсизми?')) {
                        sendInternalDocumentToPending(item.id, setMainData, mainData);
                    }
                }
            } else if (isReceiverForBuxgalter) {
                // Для MoveCash с hasBuxgalter === true получатель утверждает через setProvodkaToDoc
                setProvodkaToDoc(
                  item.id,
                  item.date,
                  token,
                  item.docStatus, // Передаем реальный статус (PENDING), setProvodkaToDoc проверит hasBuxgalter
                  setMainData,
                  mainData,
                  item.docValues?.receiverId,
                  item.docValues?.senderId,
                  setIsDisabled
                );
            } else if (
              item.docStatus === DocSTATUS.PENDING &&
              immediateProvodka &&
              !(isMoveCash && receiverHasBuxgalter)
            ) {
                setProvodkaToDoc(
                    item.id,
                    item.date,
                    token,
                    item.docStatus,
                    setMainData,
                    mainData,
                    item.docValues?.receiverId,
                    item.docValues?.senderId,
                    setIsDisabled
                );
            } else if (
              item.docStatus === DocSTATUS.PENDING &&
              user?.role === UserRoles.HEADGLOBAL &&
              !(isMoveCash && receiverHasBuxgalter)
            ) {
              // HEADGLOBAL может утверждать только если это не MoveCash с hasBuxgalter === true
              if (confirm('Хужжатни тасдиклаб проводка беришни хохлайсизми?')) {
                approveInternalDocument(item.id, setMainData, mainData);
              }
            } else {
                alert('Хужжат холати макул эмас');
            }
        }
    };

    // Определяем, показывать ли кнопки
    const user = mainData?.users?.user;
    const userEnterpriseId = user?.enterpriseId;
    
    const receiverId = item.docValues?.receiverId;
    const receiverReference = references?.find((ref: any) => ref.id === receiverId);
    
    // Проверяем hasBuxgalter для MoveCash
    const isMoveCash = item.documentType === DocumentType.MoveCash;
    // Явная проверка существования receiverReference перед проверкой hasBuxgalter
    const receiverHasBuxgalter = receiverReference ? receiverReference.refValues?.hasBuxgalter === true : false;
    const isReceiverForBuxgalter = isMoveCash && 
                                   receiverHasBuxgalter && 
                                   item.docStatus === DocSTATUS.PENDING &&
                                   receiverId &&
                                   userEnterpriseId &&
                                   receiverReference?.enterpriseId === userEnterpriseId;
    
    // Для внутренних документов со статусом PROVEDEN — HEADCOMPANY, GLAVBUX, HEADGLOBAL, ADMINGLOBAL
    // (+ ZAVSKLAD для складских списаний)
    const isInternalProveden = !item.isInterEnterprise && item.docStatus === DocSTATUS.PROVEDEN;
    const canDeleteInternalProveden = isInternalProveden && (
      user?.role === UserRoles.HEADGLOBAL ||
      user?.role === UserRoles.ADMINGLOBAL ||
      user?.role === UserRoles.HEADCOMPANY ||
      user?.role === UserRoles.GLAVBUX ||
      canZavskladEditDocument(user, item.documentType)
    );

    const isIeProveden = item.isInterEnterprise && item.docStatus === DocSTATUS.PROVEDEN;
    const canCancelIeProveden = isIeProveden && user?.role === UserRoles.ADMINGLOBAL;
    
    const dateBanned = isDocumentDateBanned(item.date, mainData?.settings?.dateBanEditing);

    const showTrashButton = !dateBanned && (isInternalProveden
            ? canDeleteInternalProveden
            : isIeProveden
              ? canCancelIeProveden
              : true);
    
    // Кнопка Save показывается:
    // 1. Для обычных документов со статусом OPEN
    // 2. Для межпредприятийных документов:
    //    - Если OPEN и это отправитель (может отправить)
    //    - Если PENDING и это получатель (может принять)
    //    - Если PENDING и это HEADGLOBAL с разрешённым receiverId (может принять от имени другой организации)
    const isHeadGlobalCanAccept = user?.role === UserRoles.HEADGLOBAL && 
                                   item.docStatus === DocSTATUS.PENDING &&
                                   item.isInterEnterprise &&
                                   item.targetEnterpriseId !== userEnterpriseId &&
                                   user?.allowedStorageIds &&
                                   Array.isArray(user.allowedStorageIds) &&
                                   user.allowedStorageIds.length > 0 &&
                                   receiverId &&
                                   user.allowedStorageIds.includes(receiverId);
    
    const showSaveButton = !dateBanned && (!item.isInterEnterprise 
            ? (
                user?.role === UserRoles.HEADGLOBAL
                    ? (
                        (item.docStatus === DocSTATUS.PENDING &&
                          !(isMoveCash && receiverHasBuxgalter)) ||
                        (immediateProvodka && item.docStatus === DocSTATUS.OPEN)
                      )
                    : (
                        item.docStatus === DocSTATUS.OPEN ||
                        isReceiverForBuxgalter ||
                        (immediateProvodka &&
                          item.docStatus === DocSTATUS.PENDING &&
                          !(isMoveCash && receiverHasBuxgalter))
                      )
              )
            : (item.docStatus === DocSTATUS.OPEN && item.sourceEnterpriseId === userEnterpriseId) ||
              (item.docStatus === DocSTATUS.PENDING && item.targetEnterpriseId === userEnterpriseId) ||
              isHeadGlobalCanAccept);

    const showDuplicateButton =
        !item.isInterEnterprise &&
        item.docStatus !== DocSTATUS.DELETED &&
        user?.role !== UserRoles.GUEST;

    const handleDuplicateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!token || isDisabled) return;
        openDuplicateDocumentDraft(
            item.id,
            token,
            setMainData as Parameters<typeof openDuplicateDocumentDraft>[2],
            mainData as Maindata,
            contentName,
            setIsDisabled
        );
    };

    return (
        <>
            <tr 
                className={cn(className, { [styles.lastActed]: isLastActed })}
                onDoubleClick={() => {getDocument(item.id, setMainData, token, mainData, contentName)}}
                onTouchStart={handleTouchStart}
            >
                <td className={cn(styles.rowId, {
                    [styles.interEnterpriseId]: item.isInterEnterprise
                })}>{item.id}</td>
                <td className={cn(styles.rowDate, { 
                        [styles.proveden]: item.docStatus == DocSTATUS.PROVEDEN,
                        [styles.deleted]: item.docStatus == DocSTATUS.DELETED,  
                        [styles.open]: item.docStatus == DocSTATUS.OPEN,
                        [styles.pending]: item.docStatus == DocSTATUS.PENDING,
                        [styles.rejected]: item.docStatus == DocSTATUS.REJECTED
                }    
                )}>{showToolsRentalColumns && item.date ? (
                    <>
                        <span className={styles.rowDateLine}>{formatDisplayDate(+item.date)}</span>
                        <span className={styles.rowDateLine}>{formatDisplayTime(+item.date)}</span>
                    </>
                ) : secondsToDateString(item.date)}</td>
                <td className={cn(styles.longRow)}>
                    {item.isInterEnterprise ? (
                        `${item.sourceEnterprise?.name || getNameEnterprise(enterprises, item.sourceEnterpriseId)} → ${item.targetEnterprise?.name || getNameEnterprise(enterprises, item.targetEnterpriseId)}`
                    ) : (
                        item.enterprise?.name || getNameEnterprise(enterprises, item.enterpriseId)
                    )}
                </td>
                {contentName === 'ALL_DOCUMENTS' && (
                    <td className={cn(styles.longRow)}>
                        {item.isInterEnterprise ? (
                            (() => {
                                const user = mainData?.users?.user;
                                const userEnterpriseId = user?.enterpriseId;
                                // Показываем тип документа в зависимости от того, кто смотрит
                                // Отправитель видит оригинальный documentType, получатель видит documentTypeForReceiver
                                if (item.targetEnterpriseId === userEnterpriseId && item.documentTypeForReceiver) {
                                    return getDescriptionDocument(item.documentTypeForReceiver);
                                }
                                // Для отправителя используем оригинальный documentType
                                return getDescriptionDocument(item.documentType);
                            })()
                        ) : (
                            getDescriptionDocument(item.documentType)
                        )}
                    </td>
                )}
                <td className={cn(styles.rowSumma, styles.tdSumma)}>{documentTotal(item)}</td>
                {showToolsRentalColumns && (
                    <td className={styles.toolsRentalCompact} title={toolsRentalAmountsLines.join('\n')}>
                        {toolsRentalAmountsLines.map((line) => (
                            <span key={line} className={styles.toolsRentalCompactLine}>{line}</span>
                        ))}
                    </td>
                )}
                {/* Для ALL_DOCUMENTS всегда показываем USD колонку, но заполняем только для LeaveCash и MoveCash */}
                {(contentName === 'ALL_DOCUMENTS' || item.documentType === DocumentType.LeaveCash || item.documentType === DocumentType.MoveCash || item.documentType === DocumentType.Advance) && (
                    <td className={cn(styles.rowSumma, styles.tdSumma)}>
                        {(item.documentType === DocumentType.LeaveCash || item.documentType === DocumentType.MoveCash || item.documentType === DocumentType.Advance) 
                            ? (item.docValues?.usd ? numberValue(item.docValues.usd) : '-')
                            : ''}
                    </td>
                )}
                <td className={cn(className, {
                    [styles.exitCompleted]: item.docValues?.exitCompleted === true
                })}>{getNameReference(references, item.docValues?.receiverId)}</td>
                <td>{getNameReference(references, item.docValues?.senderId)}</td>
                {/* Для ALL_DOCUMENTS всегда показываем Аналитика колонку, но заполняем только для документов с аналитикой */}
                {(contentName === 'ALL_DOCUMENTS' || isDocumentWithAnalitic(item.documentType)) && (
                    <td>
                        {isDocumentWithAnalitic(item.documentType) 
                            ? `${getNameReference(references, item.docValues?.analiticId)}${item.docValues?.cashFromPartner ? `  ${item.docValues?.cashFromPartner} ` : ''}`
                            : ''}
                    </td>
                )}
                {showOrderColumn && (
                    <td className={styles.longRow}>
                        {formatOrderJournalLabel(
                            item.docValues?.orderId,
                            ordersById ?? new Map(),
                        )}
                    </td>
                )}
                <td>{
                    item.documentType === DocumentType.OrderToolsToClient &&
                    Number(item.docValues?.fulfilledByTransferDocId) > 0
                        ? `ёпилган (Топшириш №${item.docValues?.fulfilledByTransferDocId})`
                        : `${item.documentType === DocumentType.Advance ? `${advancePhaseLabel(item.docValues?.advancePhase, item.docStatus)} ` : ''}${item.docValues?.comment ? `${item.docValues?.comment} - `: ''} ${item.docValues?.count ? `${item.docValues?.count}`: ''} ${item.docValues?.finPerson ? `${item.docValues?.finPerson} `: ''}`
                }</td>
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
                <td className={styles.rowAction}>
                    {showSaveButton && (
                        <IcoSave 
                            className={cn(styles.icoTrash, {
                                [styles.disabled]: isDisabled
                            })}
                            onClick={handleSaveClick}
                        />
                    )}
                </td>
                <td className={styles.rowAction}>
                    {canPrintCheck && (
                        <IcoPrint 
                            className={cn(styles.icoPrint, {
                                [styles.disabled]: isDisabled
                            })}
                            onClick={() => setShowCheck(true)}
                            title="Чек"
                        />
                    )}
                </td>
                <td className={styles.rowAction}>
                    {showDuplicateButton && (
                        <IcoDuplicate
                            className={cn(styles.icoDuplicate, {
                                [styles.disabled]: isDisabled
                            })}
                            onClick={handleDuplicateClick}
                            title="Дубликат (янги хужжат)"
                        />
                    )}
                </td>
            </tr>
            {/* Модальное окно для печати чека */}
            {showCheck && (
            <tr>
                <td
                    colSpan={
                        13 +
                        (showOrderColumn ? 1 : 0) +
                        (showToolsRentalColumns ? 1 : 0)
                    }
                    className={styles.checkModal}
                >
                    <Check 
                        document={item}
                        references={references}
                        onClose={() => setShowCheck(false)}
                    />
                </td>
            </tr>
            )}
        </>
    );
});

TableRow.displayName = 'TableRow'; 