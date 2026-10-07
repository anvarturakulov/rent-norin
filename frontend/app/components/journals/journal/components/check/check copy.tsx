'use client'
import React, { useRef, useCallback } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { DocumentModel, DocTableItem } from '@/app/interfaces/document.interface';

import styles from './check.module.css';
import { CheckProps } from './check.props';
import { getNameReference } from '../../helpers/journal.functions';
import { getUserName } from '../../helpers/journal.functions';
import { secondsToDateString } from '../../../../documents/document/doc/helpers/doc.functions';

export const Check: React.FC<CheckProps> = ({ 
  document: documentData,
  references, 
  onClose 
}) => {
  const { mainData } = useAppContext();
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    console.log('Print button clicked');
    
    // Создаем новое окно для печати
    const printWindow = window.open('', '_blank');
    
    if (printWindow && componentRef.current) {
      // Получаем HTML содержимое чека
      const receiptContent = componentRef.current.innerHTML;
      
      // Создаем полную HTML страницу для печати с точно такими же стилями
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Чек №${documentData.id}</title>
            <meta charset="utf-8">
            <style>
              @page {
                size: 80mm auto;
                margin: 5mm;
              }
              
              body {
                width: 80mm;
                font-size: 10px;
                font-family: 'Verdana', sans-serif;
                margin: 0;
                padding: 5mm;
                background: white;
              }
              
              .receipt {
                width: 80mm;
                // width: 100%;
                background: white;
                border: 1px solid #ddd;
                padding: 10px;
                font-family: 'Verdana', sans-serif;
                font-size: 14px;
                line-height: 1.2;
              }
              
              .header {
                text-align: center;
                border-bottom: 1px dashed #ccc;
                padding-bottom: 10px;
                margin-bottom: 10px;
              }
              
              .organizationName {
                font-weight: bold;
                font-size: 20px;
                text-align: center;
                margin-bottom: 5px;
                width: 100%;
              }
              
              .receiptTitle {
                font-size: 20px;
                text-align: center;
                font-weight: bold;
                text-transform: uppercase;
              }
              
              .documentInfo {
                margin-bottom: 10px;
              }
              
              .infoRow {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
                font-size: 9px;
              }
              
              .itemsTable {
                margin-bottom: 10px;
              }
              
              .tableHeader {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr;
                gap: 5px;
                font-weight: bold;
                font-size: 9px;
                border-bottom: 1px solid #ccc;
                padding-bottom: 3px;
                margin-bottom: 5px;
              }
              
              .tableRow {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                gap: 5px;
                width: 100%;
                font-size: 9px;
                margin-bottom: 2px;
              }
              
              .colName {
                word-break: break-word;
              }
              
              .colCount, .colPrice, .colTotal {
                text-align: right;
              }
              
              .totals {
                border-top: 1px dashed #ccc;
                padding-top: 10px;
                margin-bottom: 10px;
              }
              
              .totalRow {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
                font-size: 10px;
                margin-bottom: 3px;
              }
              
              .footer {
                text-align: center;
                border-top: 1px dashed #ccc;
                padding-top: 10px;
              }
              
              .signature {
                font-size: 9px;
                margin-bottom: 5px;
              }
              
              .thankYou {
                font-size: 11px;
                font-weight: bold;
              }
              
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
                .receipt {
                  border: none;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              ${receiptContent}
            </div>
          </body>
        </html>
      `;
      
      // Записываем содержимое в новое окно
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Ждем загрузки и печатаем
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
      
      // Альтернативный способ, если onload не сработает
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      // Если не удалось открыть новое окно, используем стандартную печать
      console.log('Fallback to standard print');
      window.print();
    }
  };

  // Вычисляем итоги
  const totalSum = documentData.docTableItems?.reduce((sum, item) => sum + item.total, 0) || 0;
  const totalCount = documentData.docTableItems?.reduce((sum, item) => sum + item.count, 0) || 0;
  
  // Получаем названия
  const receiverName = getNameReference(references, documentData.docValues?.receiverId);
  const senderName = getNameReference(references, documentData.docValues?.senderId);
  const userName = getUserName(documentData.userId, mainData);

  return (
    <div className={styles.container}>
      <div className={styles.printButton}>
        <button 
          onClick={() => {
            console.log('Print button clicked');
            handlePrint();
          }} 
          className={styles.printBtn}
        >
          🖨️ Печать чека
        </button>
        {onClose && (
          <button onClick={onClose} className={styles.closeBtn}>
            ✕ Закрыть
          </button>
        )}
      </div>

      <div ref={componentRef} className={styles.receipt}>
        {/* Заголовок организации */}
        <div className={styles.header}>
          <div className={styles.organizationName}>
            &apos;ZAVOD JBI-7&apos;
          </div>
          <div className={styles.receiptTitle}>
            ЧЕК
          </div>
        </div>

        {/* Информация о документе */}
        <div className={styles.documentInfo}>
          <div className={styles.infoRow}>
            <span>Номер:</span>
            <span>{documentData.id}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Сана:</span>
            <span>{secondsToDateString(documentData.date)}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Получатель:</span>
            <span>{receiverName}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Отправитель:</span>
            <span>{senderName}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Оператор:</span>
            <span>{userName}</span>
          </div>
        </div>

        {/* Таблица товаров */}
        <div className={styles.itemsTable}>
          <div className={styles.tableHeader}>
            <div className={styles.colName}>Товар</div>
            <div className={styles.colCount}>Кол-во</div>
            <div className={styles.colPrice}>Цена</div>
            <div className={styles.colTotal}>Сумма</div>
          </div>
          
          {documentData.docTableItems?.map((item: DocTableItem, index: number) => {
            const itemName = getNameReference(references, item.analiticId);
            return (
              <div key={index} className={styles.tableRow}>
                <div className={styles.colName}>{itemName}</div>
                <div className={styles.colCount}>{item.count}</div>
                <div className={styles.colPrice}>{item.price.toLocaleString()}</div>
                <div className={styles.colTotal}>{item.total.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

        {/* Итоги */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Жами сони:</span>
            <span>{totalCount}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Жами сумма:</span>
            <span>{totalSum.toLocaleString()} сум</span>
          </div>
          {documentData.docValues?.cashFromPartner && (
            <div className={styles.totalRow}>
              <span>Аванс:</span>
              <span>{documentData.docValues.cashFromPartner.toLocaleString()} сум</span>
            </div>
          )}
          {documentData.docValues?.cashFromPartner && (
            <div className={styles.totalRow}>
              <span>Қолдиқ:</span>
              <span>{(totalSum - documentData.docValues.cashFromPartner).toLocaleString()} сум</span>
            </div>
          )}
        </div>

        {/* Подпись */}
        <div className={styles.footer}>
          <div className={styles.signature}>
            Подпись оператора: _________________
          </div>
          <div className={styles.thankYou}>
            Рахмат!
          </div>
        </div>
      </div>
    </div>
  );
};