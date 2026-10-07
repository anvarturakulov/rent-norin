import React, { memo } from 'react';
import cn from 'classnames';
import styles from '../docTableCatalog.module.css';
import CartIco from '../ico/cart.svg';
import { DocSTATUS, DocumentType, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';

interface TableHeaderProps {
  onOpenCatalog?: () => void;
  onOpenPicker?: () => void;
  onOpenFormwork?: () => void;
  onImportProducts?: () => void;
  onCalculateMaterials?: () => void;
  docStatus: DocSTATUS;
  docType: DocumentType;
  typeDocumentByComeOut: TypeDocumentByComeOut;
  hasIncomeItems?: boolean;
  isCalculating?: boolean;
}

const TableHeader = memo<TableHeaderProps>(({ 
  onOpenCatalog,
  onOpenPicker,
  onOpenFormwork,
  onImportProducts, 
  onCalculateMaterials,
  docStatus, 
  docType, 
  typeDocumentByComeOut,
  hasIncomeItems,
  isCalculating,
  ...props 
}) => {
  const osOutDocTypes: DocumentType[] = [
    DocumentType.AmortizasiyaOS,
    DocumentType.LeaveOS,
    DocumentType.MoveOS,
    DocumentType.SaleOS,
  ];
  const isOsOutDoc = osOutDocTypes.includes(docType);
  const isComeTools = docType === DocumentType.ComeTools;
  const isMoveTools = docType === DocumentType.MoveTools;
  const isLeaveTools = docType === DocumentType.LeaveTools;
  const isSaleTools = docType === DocumentType.SaleTools;
  const isTransferToolsToClient = docType === DocumentType.TransferToolsToClient;
  const isOrderToolsToClient = docType === DocumentType.OrderToolsToClient;
  const isTransferSublease =
    docType === DocumentType.TransferSubleaseToolsToClient;
  const isToolsDoc =
    isComeTools ||
    isMoveTools ||
    isLeaveTools ||
    isSaleTools ||
    isTransferToolsToClient ||
    isOrderToolsToClient ||
    isTransferSublease;
  const isSaleMaterial = docType === DocumentType.SaleMaterial;
  const title = isComeTools
    ? 'Ускуналар кирими руйхати'
    : isMoveTools
      ? 'Ускуналар силжиши руйхати'
      : isLeaveTools
        ? 'Ускуна чикими руйхати'
        : isSaleTools
          ? 'Ускуна сотуви руйхати'
        : isTransferToolsToClient || isOrderToolsToClient || isTransferSublease
          ? 'Ускуналар руйхати'
        : isSaleMaterial
          ? 'Хом ашё сотуви учун'
        : typeDocumentByComeOut === 'come'
          ? 'ТМБ киримдаги товарлар'
          : isOsOutDoc
            ? 'Асосий воситалар'
            : 'ТМБ чикимдаги товарлар';
  const addButtonLabel = isTransferSublease
    ? '+ Ускуна кушиш'
    : isToolsDoc
    ? '+ Ускуналарни кушиш'
    : isOsOutDoc || docType === DocumentType.ComeOS
      ? '+ Асосий восита'
      : isSaleMaterial
        ? '+ Хом ашёларни кушиш'
      : '+ Товарларни кушиш';
  const isComeProduct = docType === DocumentType.ComeProduct;
  const isDocumentReady = docStatus && docType; // Проверяем, что документ полностью загружен

  console.log('TableHeader render:', {
    docStatus,
    docType,
    isComeProduct,
    isDocumentReady,
    hasOnImportProducts: !!onImportProducts
  });

  return (
    <div className={cn(styles.boxHeader, styles.titleBox, {})}>
      <div className={styles.title}>
        <CartIco className={styles.icoCart}/>
        <div className={styles.titleText}>{title}</div>
      </div>
      {
        docStatus == DocSTATUS.OPEN && isDocumentReady && (
          <div className={styles.buttonGroup}>
            {false &&isComeProduct && onImportProducts && (
              <button 
                className={styles.importBtn}
                onClick={onImportProducts}
                >
                📥 Импорт товаров
              </button>
            )}
            {/* Кнопка "Заполнить по норме" скрыта для ComeProduct — материалы вносятся вручную */}
            {false && isComeProduct && hasIncomeItems && onCalculateMaterials && (
              <button 
                className={styles.calculateBtn}
                onClick={onCalculateMaterials}
                disabled={isCalculating}
                >
{isCalculating ? '⏳ Рассчитываем...' : '🧮 Заполнить материалы'}
              </button>
            )}
            {isTransferToolsToClient && onOpenPicker && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={onOpenPicker}
              >
                + Танлаб олиш
              </button>
            )}
            {(isTransferToolsToClient || isOrderToolsToClient) && onOpenFormwork && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={onOpenFormwork}
                title="Фундамент чизмаси бўйича опалубка тўпламини ҳисоблаш"
              >
                ▦ Опалубка
              </button>
            )}
            <button 
              className={styles.addBtn}
              onClick={onOpenCatalog}
              >
              {addButtonLabel}
            </button>
          </div>
        )
      }
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

export default TableHeader; 