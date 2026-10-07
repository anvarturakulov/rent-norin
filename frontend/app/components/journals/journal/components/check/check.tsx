'use client';
import React, { useRef } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { DocumentModel, DocTableItem, DocumentType } from '@/app/interfaces/document.interface';
import styles from './check.module.css';
import { CheckProps } from './check.props';
import { getNameReference, getUserName, getAddressReference, getPhoneReference, getInnReference, getUnitReference } from '../../helpers/journal.functions';
import { secondsToDateString } from '../../../../documents/document/doc/helpers/doc.functions';
import { numberValue } from '@/app/service/common/converters';

export const Check: React.FC<CheckProps> = ({
  document: documentData,
  references,
  onClose,
}) => {
  const { mainData } = useAppContext();
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');

    if (printWindow && componentRef.current) {
      const receiptContent = componentRef.current.innerHTML;

      // Копируем все стили (включая <style> и <link>)
      let styles = '';
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          if (styleSheet.cssRules) {
            Array.from(styleSheet.cssRules).forEach((rule) => {
              styles += rule.cssText;
            });
          }
        } catch (e) {
          console.warn('⚠️ Ошибка доступа к CSS правилам (CORS):', e);
        }
      });

      // Создаем контент для двух копий
      const firstCopy = `
        <div class="invoice-copy">
          ${receiptContent}
        </div>
      `;

      const secondCopy = `
        <div class="invoice-copy">
          ${receiptContent}
        </div>
      `;

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Накладной №${documentData.id} - 2 копии</title>
            <style>
              ${styles}
              
              /* Стили для двух копий */
              .invoice-copy {
                page-break-after: always;
                margin-bottom: 0;
              }
              
              .invoice-copy:last-child {
                page-break-after: avoid;
              }
              
              /* ПРИНУДИТЕЛЬНЫЕ СТИЛИ ДЛЯ ПЕЧАТИ */
              body {
                font-size: 18px !important;
                font-family: Arial, sans-serif !important;
              }
              
              /* Базовые элементы */
              div[class*="invoice"] {
                font-size: 18px !important;
              }
              
              /* ШАПКА - точные размеры */
              div[class*="companyName"] {
                font-size: 24px !important;
                font-weight: bold !important;
              }
              
              div[class*="documentTitle"] h1 {
                font-size: 16px !important;
              }
              
              span[class*="documentNumber"] {
                font-size: 19.8px !important;
                font-weight: bold !important;
              }
              
              span[class*="documentDate"] {
                font-size: 19.8px !important;
              }
              
              /* РЕКВИЗИТЫ - уменьшение на 20% */
              div[class*="senderInfo"] h3, 
              div[class*="receiverInfo"] h3 {
                font-size: 16px !important;
              }
              
              div[class*="partyDetails"], 
              div[class*="partyDetails"] div, 
              div[class*="partyDetails"] strong { 
                font-size: 16px !important; 
              }
              
              /* Названия в реквизитах - высота в три строки */
              div[class*="partyDetails"] div:first-child {
                min-height: 3.6em !important;
                line-height: 1.2 !important;
              }
              
              /* ТАБЛИЧНАЯ ЧАСТЬ - базовый размер */
              table[class*="productsTable"], 
              table[class*="productsTable"] td { 
                font-size: 18px !important; 
              }
              /* Заголовок таблицы: −10% и полужирный 500 */
              table[class*="productsTable"] th {
                font-size: 16.2px !important;
                font-weight: 500 !important;
              }

              /* Итоги: увеличить размер строки общей суммы (на уровне span для гарантии) */
              div[class*="totals"] div[class*="totalRow"],
              div[class*="totals"] div[class*="totalRow"] span {
                font-size: 24px !important;
                line-height: 1.25 !important;
              }
              /* Сделать сумму более заметной */
              div[class*="totals"] div[class*="totalRow"] span:last-child {
                font-weight: 700 !important;
              }

              /* Ширины колонок для печати: уменьшаем Наименование, расширяем Цена и Сумма */
              table[class*="productsTable"] th[class*="colNumber"],
              table[class*="productsTable"] td[class*="colNumber"] { width: 5% !important; }
              table[class*="productsTable"] th[class*="colName"],
              table[class*="productsTable"] td[class*="colName"]   { width: 34% !important; }
              table[class*="productsTable"] th[class*="colUnit"],
              table[class*="productsTable"] td[class*="colUnit"]   { width: 8% !important; }
              table[class*="productsTable"] th[class*="colQuantity"],
              table[class*="productsTable"] td[class*="colQuantity"]{ width: 12% !important; }
              table[class*="productsTable"] th[class*="colPrice"],
              table[class*="productsTable"] td[class*="colPrice"]  { width: 20% !important; }
              table[class*="productsTable"] th[class*="colTotal"],
              table[class*="productsTable"] td[class*="colTotal"]  { width: 21% !important; }
              
              /* НИЖНЯЯ ЧАСТЬ - без изменений */
              div[class*="carDetails"] {
                font-size: 16px !important;
              }
              
              div[class*="totalRow"] {
                font-size: 18px !important;
              }
              
              div[class*="totalRow"]:last-child {
                font-size: 20px !important;
              }
              
              div[class*="signatureTitle"] {
                font-size: 16px !important;
              }
              
              div[class*="signatureLine"] {
                font-size: 16.8px !important;
              }
              
              div[class*="additionalInfo"] h4 {
                font-size: 16px !important;
              }
              
              div[class*="additionalInfo"] p {
                font-size: 14px !important;
              }
              
              @media print {
                .invoice-copy {
                  page-break-after: always;
                  margin: 0;
                  padding: 0;
                }
                
                .invoice-copy:last-child {
                  page-break-after: avoid;
                }
                
                /* ПРИНУДИТЕЛЬНЫЕ СТИЛИ ДЛЯ ПЕЧАТИ */
                body {
                  font-size: 18px !important;
                }
                
                /* Базовые элементы */
                div[class*="invoice"] {
                  font-size: 18px !important;
                }
                
                /* ШАПКА - точные размеры */
                div[class*="companyName"] {
                  font-size: 24px !important;
                }
                
                div[class*="documentTitle"] h1 {
                  font-size: 17.6px !important;
                }
                
                span[class*="documentNumber"] {
                  font-size: 19.8px !important;
                }
                
                span[class*="documentDate"] {
                  font-size: 19.8px !important;
                }
                
                /* РЕКВИЗИТЫ - уменьшение на 20% */
                div[class*="senderInfo"] h3, 
                div[class*="receiverInfo"] h3 {
                  font-size: 16px !important;
                }
                
                div[class*="partyDetails"], 
                div[class*="partyDetails"] div, 
                div[class*="partyDetails"] strong {
                  font-size: 16px !important;
                }
                
                /* Названия в реквизитах - высота в три строки */
                div[class*="partyDetails"] div:first-child {
                  min-height: 3.6em !important;
                  line-height: 1.2 !important;
                }
                
                /* ТАБЛИЧНАЯ ЧАСТЬ - базовый размер */
                table[class*="productsTable"], 
                table[class*="productsTable"] td { 
                  font-size: 18px !important; 
                }
                /* Заголовок таблицы: −10% и полужирный 500 */
                table[class*="productsTable"] th {
                  font-size: 16.2px !important;
                  font-weight: 500 !important;
                }
                
                /* Итоги: увеличить размер строки общей суммы (портрет, на уровне span) */
                div[class*="totals"] div[class*="totalRow"],
                div[class*="totals"] div[class*="totalRow"] span {
                  font-size: 16px !important;
                  line-height: 1.25 !important;
                }
                /* Сделать сумму более заметной (портрет) */
                div[class*="totals"] div[class*="totalRow"] span:last-child {
                  font-weight: 700 !important;
                }

                /* Ширины колонок для печати: уменьшаем Наименование, расширяем Цена и Сумма */
                table[class*="productsTable"] th[class*="colNumber"],
                table[class*="productsTable"] td[class*="colNumber"] { width: 5% !important; }
                table[class*="productsTable"] th[class*="colName"],
                table[class*="productsTable"] td[class*="colName"]   { width: 34% !important; }
                table[class*="productsTable"] th[class*="colUnit"],
                table[class*="productsTable"] td[class*="colUnit"]   { width: 8% !important; }
                table[class*="productsTable"] th[class*="colQuantity"],
                table[class*="productsTable"] td[class*="colQuantity"]{ width: 12% !important; }
                table[class*="productsTable"] th[class*="colPrice"],
                table[class*="productsTable"] td[class*="colPrice"]  { width: 20% !important; }
                table[class*="productsTable"] th[class*="colTotal"],
                table[class*="productsTable"] td[class*="colTotal"]  { width: 21% !important; }
                
                /* НИЖНЯЯ ЧАСТЬ - без изменений */
                div[class*="carDetails"] {
                  font-size: 16px !important;
                }
                
                div[class*="totalRow"] {
                  font-size: 18px !important;
                }
                
                div[class*="totalRow"]:last-child {
                  font-size: 20px !important;
                }
                
                div[class*="signatureTitle"] {
                  font-size: 16px !important;
                }
                
                div[class*="signatureLine"] {
                  font-size: 16.8px !important;
                }
                
                div[class*="additionalInfo"] h4 {
                  font-size: 16px !important;
                }
                
                div[class*="additionalInfo"] p {
                  font-size: 14px !important;
                }
              }
            </style>
          </head>
          <body>
            ${firstCopy}
            ${secondCopy}
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 100);
      };
    } else {
      window.print(); // fallback
    }
  };

  const totalSum = documentData.docTableItems?.reduce((sum, item) => sum + item.total, 0) || 0;
  const totalCount = documentData.docTableItems?.reduce((sum, item) => sum + item.count, 0) || 0;
  const receiverName = getNameReference(references, documentData.docValues?.receiverId);
  const senderName = getNameReference(references, documentData.docValues?.senderId);
  const userName = getUserName(documentData.userId, mainData);
  
  // Получаем данные организации (отправителя)
  const senderAddress = getAddressReference(references, documentData.docValues?.senderId);
  const senderPhone = getPhoneReference(references, documentData.docValues?.senderId);
  const senderInn = getInnReference(references, documentData.docValues?.senderId);
  
  // Получаем данные получателя
  const receiverAddress = getAddressReference(references, documentData.docValues?.receiverId);
  const receiverPhone = getPhoneReference(references, documentData.docValues?.receiverId);
  const receiverInn = getInnReference(references, documentData.docValues?.receiverId);
  
  // Получаем данные об автомобиле
  const carName = getNameReference(references, documentData.docValues?.carId);
  const carGosNomer = references?.find((item: any) => item.id == documentData.docValues?.carId)?.refValues?.gosNomer || '';
  const carDisplayName = carGosNomer ? `${carName} (${carGosNomer})` : carName;
  
  // Получаем данные о сотруднике-отправителе
  const senderPersonName = getNameReference(references, documentData.docValues?.senderPersonId);

  // Определяем тип документа для заголовка
  const getDocumentTitle = () => {
    switch (documentData.documentType) {
      case DocumentType.SaleProd:
        return 'НАКЛАДНОЙ';
      case DocumentType.SaleMaterial:
        return 'НАКЛАДНОЙ';
      case DocumentType.SaleOS:
        return 'НАКЛАДНОЙ';
      case DocumentType.SaleHalfStuff:
        return 'НАКЛАДНОЙ';
      default:
        return 'НАКЛАДНОЙ';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.printButton}>
        <button onClick={handlePrint} className={styles.printBtn}>🖨️ Печать накладной (2 копии)</button>
        {onClose && (
          <button onClick={onClose} className={styles.closeBtn}>✕ Закрыть</button>
        )}
      </div>

      <div ref={componentRef} className={styles.invoice}>
        {/* Заголовок документа */}
        <div className={styles.invoiceHeader}>
          <div className={styles.logoSection}>
            <div className={styles.logo}>
              <img src="/images/logo.svg" alt="ZAVOD JBI-7 Logo" className={styles.logoImage} />
            </div>
          </div>
          <div className={styles.documentTitle}>
            <div className={styles.companyName}>ООО "ZAVOD JBI-7"</div>
            <h1>{getDocumentTitle()}</h1>
            <div className={styles.documentInfo}>
              <span className={styles.documentNumber}>№ {documentData.id}</span>
              <span className={styles.documentDate}>от {secondsToDateString(documentData.date)}</span>
            </div>
          </div>
        </div>

        {/* Информация об отправителе и получателе */}
        <div className={styles.partiesInfo}>
          <div className={styles.senderInfo}>
            <h3>Поставщик (Отправитель):</h3>
            <div className={styles.partyDetails}>
              <div><strong>Наименование:</strong> {senderName}</div>
              <div><strong>Адрес:</strong> Окдарё Тараккиёт МФЙ</div>
              <div><strong>Телефон:</strong> 98 200 41 47</div>
              <div><strong>ИНН:</strong> 305 396 248</div>
              {/* <div><strong>Ответственное лицо:</strong> {userName}</div> */}
            </div>
          </div>
          
          <div className={styles.receiverInfo}>
            <h3>Покупатель (Получатель):</h3>
            <div className={styles.partyDetails}>
              <div><strong>Наименование:</strong> {receiverName}</div>
              <div><strong>Адрес:</strong> {receiverAddress !== '-' ? receiverAddress : 'Не указан'}</div>
              <div><strong>Телефон:</strong> {receiverPhone !== '-' ? receiverPhone : 'Не указан'}</div>
              <div><strong>ИНН:</strong> {receiverInn !== '-' ? receiverInn : 'Не указан'}</div>
            </div>
          </div>
        </div>

        {/* Таблица товаров */}
        <div className={styles.itemsTable}>
          <table className={styles.productsTable}>
            <thead>
              <tr>
                <th className={styles.colNumber}>№</th>
                <th className={styles.colName}>Наименование товара</th>
                <th className={styles.colUnit}>Ед. изм.</th>
                <th className={styles.colQuantity}>Кол-во</th>
                <th className={styles.colPrice}>Цена за ед.</th>
                <th className={styles.colTotal}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {documentData.docTableItems?.map((item: DocTableItem, index: number) => {
                const itemName = getNameReference(references, item.analiticId);
                const itemUnit = getUnitReference(references, item.analiticId);
                return (
                  <tr key={index}>
                    <td className={styles.colNumber}>{index + 1}</td>
                    <td className={styles.colName}>{itemName}</td>
                    <td className={styles.colUnit}>{itemUnit}</td>
                    <td className={styles.colQuantity}>{item.count}</td>
                    <td className={styles.colPrice}>{numberValue(item.price)}</td>
                    <td className={styles.colTotal}>{numberValue(item.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Итоги */}
        <div className={styles.totals}>
          <div className={styles.totalsTable}>
            <div className={styles.totalRow}>
              <span>Общая сумма:</span>
              <span>{numberValue(totalSum)} сум</span>
            </div>
          </div>
        </div>

        {/* Секция Автомашина */}
        {(documentData.docValues?.carId || documentData.docValues?.driver) && (
          <div className={styles.carSection}>
            <div className={styles.carInfo}>
              <div className={styles.carDetails}>
                <span><strong>Автомашина:</strong> {documentData.docValues?.carId ? carDisplayName : 'Не указана'}</span>
                {documentData.docValues?.driver && (
                  <span><strong>Хайдовчи:</strong> {documentData.docValues.driver}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Подписи */}
        <div className={styles.signatures}>
          <div className={styles.signatureBlock}>
            <div className={styles.signatureTitle}>Поставщик:</div>
            <div className={styles.signatureLine}>
              <span>Подпись: __________</span>
              <span>Ф.И.О.: {senderPersonName !== 'Аникланмади' ? senderPersonName : userName}</span>
            </div>
            <div className={styles.signatureLine}>
              <span>Дата: {secondsToDateString(documentData.date)}</span>
            </div>
          </div>
          
          <div className={styles.signatureBlock}>
            <div className={styles.signatureTitle}>Покупатель:</div>
            <div className={styles.signatureLine}>
              <span>Подпись: _________________</span>
            </div>
            <div className={styles.signatureLine}>
              <span>Ф.И.О.: _________________</span>
            </div>
          </div>
        </div>

        {/* Дополнительная информация */}
        {documentData.docValues?.comment && (
          <div className={styles.additionalInfo}>
            <h4>Дополнительная информация:</h4>
            <p>{documentData.docValues.comment}</p>
          </div>
        )}
      </div>
    </div>
  );
};
