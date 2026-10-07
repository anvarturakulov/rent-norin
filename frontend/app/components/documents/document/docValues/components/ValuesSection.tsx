import React, { memo, useCallback, useMemo, useEffect, useState } from 'react';
import cn from 'classnames';
import { SelectReferenceInForm } from '../../selects/selectReferenceInForm/selectReferenceInForm';
import { InputInForm } from '../../inputs/inputInForm/inputInForm';
import { DocumentType, DocSTATUS } from '@/app/interfaces/document.interface';
import { getPriceAndBalance } from '@/app/service/documents/getPriceBalance';
import { addItems } from '../doc.values.functions';
import { defaultDocumentTableItem } from '@/app/context/app.context.helpers.constants';
import { getLabelForAnalitic, getTypeReferenceForAnalitic } from '../doc.values.functions';
import { DOC_VALUES_LABELS } from '../constants/docValues.constants';
import styles from '../docValues.module.css';
import { useAppContext } from '@/app/context/app.context';
import { DocTableCatalog } from '../../docTableCatalog/docTableCatalog';
import { getDocumentTypeByComeOut } from './helpers/getDocumentTypeByComeOut';
import { getStorageIdForDocument } from '@/app/service/documents/getStorageIdForDocument';
import useSWR from 'swr';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { MenuVisibilitySettings } from '@/app/interfaces/enterprise.interface';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { DocInvoiceImage } from './DocInvoiceImage';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import { fillAmortizasiyaOsTable } from '@/app/service/documents/fillAmortizasiyaOsTable';
import { fillLeaveMaterialFromOrder } from '@/app/service/documents/fillLeaveMaterialFromOrder';
import { fillLeaveHalfstuffFromOrder } from '@/app/service/documents/fillLeaveHalfstuffFromOrder';
import { FurnitureOrder, OrderWork } from '@/app/interfaces/furnitureOrder.interface';
import { MediatorBonusPreview } from './mediatorBonusPreview/mediatorBonusPreview';
import { formatOrderAmount } from '@/app/components/furnitureOrders/helpers/orderPrice';
import { ClientBalanceInfo } from './clientBalanceInfo/clientBalanceInfo';
import { ClientOperationsSummary } from './clientBalanceInfo/clientOperationsSummary';
import { SelectDeliverer } from '../../selects/selectDeliverer/selectDeliverer';
import CartIco from '../../docTableCatalog/ico/cart.svg';
import { AdvanceLinesTable } from './advanceLinesTable/advanceLinesTable';

interface ValuesSectionProps {
  options: any;
  currentDocument: any;
  currentValues: {
    receiverId: number | undefined;
    senderId: number | undefined;
    analiticId: number | undefined;
    productForChargeId: number | undefined;
    count: number | undefined;
    price: number | undefined;
    total: number | undefined;
    cashFromPartner: number | undefined;
    comment: string | undefined;
    isPartner: boolean | undefined;
    isClient: boolean | undefined;
    isDepartment: boolean | undefined;
    isWorker: boolean | undefined;
    finPerson: string | undefined;
    driver: string | undefined;
    senderPersonId: number | undefined;
    carId: number | undefined;
    remainCount?: number | undefined;
    orderId?: number | undefined;
    workId?: number | undefined;
    deadlineDate: number | undefined;
    materialResponsiblePersonId?: number | undefined;
    invoiceImagePath?: string | undefined;
  };
  checkboxStates: {
    hasWorkers: boolean;
    hasMediators: boolean;
    hasDeliverers: boolean;
    hasPartners: boolean;
    hasClients: boolean;
    hasFounders: boolean;
    hasDepartments: boolean;
  };
  contentName: string;
  setMainData: Function | undefined;
  mainData: any;
  definedIds: {
    analitic: number | undefined;
  };
}

const ValuesSection = memo<ValuesSectionProps>(({
  options,
  currentDocument,
  currentValues,
  checkboxStates,
  contentName,
  setMainData,
  mainData,
  definedIds
}) => {
  // Получаем warehouseId в зависимости от типа документа
  const typeDocumentByComeOut = getDocumentTypeByComeOut(currentDocument?.documentType);
  
  const storageId = getStorageIdForDocument(currentDocument?.documentType as string, currentDocument?.docValues?.senderId, currentDocument?.docValues?.receiverId);
  
  const warehouseId = storageId;
  
  
  // Мемоизируем обработчик добавления элементов
  const handleAddItems = useCallback(() => {
    addItems(setMainData, mainData, { ...defaultDocumentTableItem });
  }, [setMainData, mainData]);

  // Мемоизируем лейбл для total
  const totalLabel = contentName === DocumentType.SaleProd 
    ? DOC_VALUES_LABELS.PRODUCT_TOTAL 
    : DOC_VALUES_LABELS.TOTAL;

  const documentType = currentDocument?.documentType;
  const isLeaveOnlyOneMaterial = documentType === DocumentType.LeaveOnlyOneMaterial;
  // Документы, в которых можно привязать orderId (списание S20 / приход / продажа).
  // Заказ обязателен только для LeaveOnlyOneMaterial; для остальных пусто = без заказа.
  const isOrderAwareDocument = useMemo(() => ([
    DocumentType.LeaveCash,
    DocumentType.LeaveMaterial,
    DocumentType.LeaveOnlyOneMaterial,
    DocumentType.AmortizasiyaOS,
    DocumentType.ZpCalculate,
    DocumentType.ServicesFromPartners,
    DocumentType.ServicesToClients,
    DocumentType.LeaveOS,
    DocumentType.LeaveHalfstuff,
    DocumentType.ComeProduct,
    DocumentType.SaleProd,
  ] as DocumentType[]).includes(documentType), [documentType]);

  // Логика для отображения/редактирования организации
  const { user } = mainData.users;
  const { isNewDocument } = mainData.document;
  const token = user?.token;
  const isGlobal = user?.role && isGlobalRole(user.role);
  
  // Загружаем глобальные настройки для GLOBAL ролей
  const globalSettingsUrl = isGlobal && token 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/global/menuVisibility`
    : null;
  const { data: globalMenuVisibility } = useSWR(
    globalSettingsUrl,
    (url) => getDataForSwr(url, token)
  );

  // Проверяем, может ли пользователь редактировать организацию
  const canEditEnterprise = useMemo(() => {
    if (!isNewDocument) return false;
    
    if (!user?.role) return false;
    
    // Для GLOBAL ролей проверяем право canEditDocuments
    if (isGlobal && globalMenuVisibility) {
      const roleSettings = (globalMenuVisibility as MenuVisibilitySettings)[user.role];
      return roleSettings?.canEditDocuments === true;
    }
    
    return false;
  }, [isNewDocument, user?.role, isGlobal, globalMenuVisibility]);

  const { data: enterprises } = useSWR(
    token ? 'enterprises' : null,
    () => getEnterprises(token)
  );

  const targetEnterpriseId = currentDocument?.enterpriseId ?? mainData.report?.selectedEnterpriseId ?? user?.enterpriseId;
  const selectedOrderId = Number(currentValues.orderId || 0);
  const [orderSearch, setOrderSearch] = useState('');

  const { data: leaveOnlyOneMaterialOrders } = useSWR<FurnitureOrder[]>(
    token && targetEnterpriseId && isOrderAwareDocument
      ? ['order-aware-document-orders', token, targetEnterpriseId]
      : null,
    () => foApi.getOrders(token, Number(targetEnterpriseId))
  );

  const { data: leaveOnlyOneMaterialWorks } = useSWR<OrderWork[]>(
    token && isLeaveOnlyOneMaterial && selectedOrderId > 0
      ? ['leave-only-one-material-works', token, selectedOrderId]
      : null,
    () => foApi.getWorksByOrder(token, selectedOrderId)
  );

  const filteredLeaveOnlyOneMaterialOrders = useMemo(() => {
    const orders = leaveOnlyOneMaterialOrders || [];
    const query = orderSearch.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) => {
      const byOrderNumber = (order.orderNumber || '').toLowerCase().includes(query);
      const byAnalitic = (order.analitic?.name || '').toLowerCase().includes(query);
      const byClient = (order.client?.name || '').toLowerCase().includes(query);
      return byOrderNumber || byAnalitic || byClient;
    });
  }, [leaveOnlyOneMaterialOrders, orderSearch]);

  // Получаем все справочники, чтобы определить isForeign для складов
  const { data: allReferences } = useSWR(
    token ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/all/` : null,
    (url) => getDataForSwr(url, token)
  );

  const shouldShowCurrencyFields = useMemo(() => {
    if (!currentDocument?.docValues || !Array.isArray(allReferences)) return false;

    const { senderId, receiverId } = currentDocument.docValues;
    const sender = allReferences.find((ref: ReferenceModel) => ref.id === senderId);
    const receiver = allReferences.find((ref: ReferenceModel) => ref.id === receiverId);

    return Boolean(sender?.refValues?.isForeign || receiver?.refValues?.isForeign);
  }, [
    allReferences,
    currentDocument?.docValues?.senderId,
    currentDocument?.docValues?.receiverId
  ]);

  // Устанавливаем enterpriseId из пользователя, если у пользователя нет права canEditDocuments
  useEffect(() => {
    if (!isNewDocument || !currentDocument || !user) return;
    
    // Если enterpriseId уже установлен, не меняем его
    if (currentDocument.enterpriseId) return;
    
    // Для GLOBAL ролей проверяем право canEditDocuments
    if (isGlobal && globalMenuVisibility) {
      const roleSettings = (globalMenuVisibility as MenuVisibilitySettings)[user.role];
      const hasEditPermission = roleSettings?.canEditDocuments === true;
      
      // Если нет права редактировать, устанавливаем enterpriseId из пользователя
      if (!hasEditPermission && user.enterpriseId) {
        if (setMainData) {
          setMainData('currentDocument', {
            ...currentDocument,
            enterpriseId: user.enterpriseId
          });
        }
      }
    } else if (user.enterpriseId) {
      // Для не-GLOBAL ролей устанавливаем enterpriseId из пользователя
      if (setMainData) {
        setMainData('currentDocument', {
          ...currentDocument,
          enterpriseId: user.enterpriseId
        });
      }
    }
  }, [isNewDocument, currentDocument, user, isGlobal, globalMenuVisibility, setMainData]);

  const handleEnterpriseChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === '' ? null : Number(e.target.value);
    if (setMainData && currentDocument) {
      setMainData('currentDocument', {
        ...currentDocument,
        enterpriseId: value
      });
    }
  }, [setMainData, currentDocument]);

  const handleOrderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextOrderId = Number(e.target.value || 0);
    if (!setMainData || !currentDocument) return;

    setMainData('currentDocument', {
      ...currentDocument,
      docValues: {
        ...currentDocument.docValues,
        orderId: nextOrderId,
        workId: 0,
      },
    });
  }, [setMainData, currentDocument]);

  const handleWorkChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextWorkId = Number(e.target.value || 0);
    if (!setMainData || !currentDocument) return;

    setMainData('currentDocument', {
      ...currentDocument,
      docValues: {
        ...currentDocument.docValues,
        workId: nextWorkId,
      },
    });
  }, [setMainData, currentDocument]);

  // Проверяем, нужно ли показывать analiticId для ComeCashFromClients на основе isOffice у receiver
  const shouldShowAnaliticForComeCashFromClients = useMemo(() => {
    if (contentName !== DocumentType.ComeCashFromClients) return false;
    if (!currentDocument?.docValues?.receiverId || !Array.isArray(allReferences)) return false;
    
    const receiver = allReferences.find((ref: ReferenceModel) => ref.id === currentDocument.docValues.receiverId);
    return Boolean(receiver?.refValues?.isOffice);
  }, [
    contentName,
    currentDocument?.docValues?.receiverId,
    allReferences
  ]);

  const formatOrderDate = useCallback((value?: number | string) => {
    if (!value) return '';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU');
  }, []);

  const formatOrderOptionLabel = useCallback((order: FurnitureOrder) => {
    const parts: string[] = [];
    if (order.orderNumber) parts.push(`№${order.orderNumber}`);
    const date = formatOrderDate(order.orderDate || order.createdDate);
    if (date) parts.push(date);
    if (order.count != null) parts.push(`кол-во: ${order.count}`);
    if (order.total != null && Number(order.total) > 0) {
      parts.push(`сумма: ${formatOrderAmount(order.total)}`);
    }
    if (order.analitic?.name) parts.push(order.analitic.name);
    if (order.client?.name) parts.push(order.client.name);
    return parts.join(' | ');
  }, [formatOrderDate]);

  // Определяем финальную видимость analiticId
  const analiticIsVisible = useMemo(() => {
    if (contentName === DocumentType.ComeCashFromClients) {
      return shouldShowAnaliticForComeCashFromClients;
    }
    return options.analiticIsVisible;
  }, [contentName, shouldShowAnaliticForComeCashFromClients, options.analiticIsVisible]);

  return (
    <div className={cn(styles.valuesBox)}>
      <div className={styles.analiticBox}>
        <SelectReferenceInForm 
          key={`analitic-${getTypeReferenceForAnalitic(currentDocument, options)}`}
          label={getLabelForAnalitic(currentDocument, options)} 
          typeReference={getTypeReferenceForAnalitic(currentDocument, options)}
          visibile={analiticIsVisible}
          currentItemId={currentValues.analiticId}
          type='analitic'
          // definedItemId={definedIds.analitic}
        />

        <SelectReferenceInForm 
          key={`productForCharge-${options.productForChargeType}`}
          label={options.productForChargeLabel} 
          typeReference={options.productForChargeType}
          visibile={options.productForChargeIsVisible}
          currentItemId={currentValues.productForChargeId}
          type='productForCharge'
          // definedItemId={definedIds.analitic}
        />

      <SelectReferenceInForm 
          key={`car-${options.carType}`}
          label={options.carLabel} 
          typeReference={options.carType}
          visibile={options.carIsVisible}
          currentItemId={currentValues.carId}
          type='car'
          // definedItemId={definedIds.analitic}
        />

        <InputInForm 
          nameControl='finPerson' 
          type='text'   
          label={DOC_VALUES_LABELS.FIN_PERSON} 
          visible={options.finPersonIsVisible}
          labelPosition='top'
        />

        <InputInForm 
          nameControl='driver' 
          type='text' 
          label={DOC_VALUES_LABELS.DRIVER} 
          visible={options.driverIsVisible}
          labelPosition='top'
        />

        <SelectReferenceInForm 
          key={`senderPerson-${options.senderPersonType}`}
          label={options.senderPersonLabel} 
          typeReference={options.senderPersonType}
          visibile={options.senderPersonIsVisible}
          currentItemId={currentValues.senderPersonId}
          type='senderPerson'
          // definedItemId={definedIds.analitic}
        />

        <SelectReferenceInForm
          key={`materialResponsiblePerson-${options.materialResponsiblePersonType}`}
          label={options.materialResponsiblePersonLabel}
          typeReference={options.materialResponsiblePersonType}
          visibile={options.materialResponsiblePersonIsVisible}
          currentItemId={currentValues.materialResponsiblePersonId}
          type='materialResponsiblePerson'
        />

        {isOrderAwareDocument && (
          <>
            <div className={styles.linkedSelectBox}>
              <label className={styles.linkedSelectLabel}>Заказ</label>
              <input
                type="text"
                className={styles.linkedSearchInput}
                placeholder="Поиск: номер заказа, название, клиент"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <select
                className={styles.linkedSelect}
                value={currentValues.orderId || 0}
                onChange={handleOrderChange}
              >
                <option value={0}>
                  {isLeaveOnlyOneMaterial
                    ? 'Выберите заказ'
                    : documentType === DocumentType.ComeProduct
                      ? 'Без заказа'
                    : documentType === DocumentType.SaleProd ||
                        documentType === DocumentType.ServicesToClients
                      ? 'Без заказа (продажа без заказа)'
                        : 'Без заказа (общие расходы)'}
                </option>
                {filteredLeaveOnlyOneMaterialOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {formatOrderOptionLabel(order)}
                  </option>
                ))}
              </select>
              {documentType === DocumentType.LeaveMaterial &&
                currentDocument?.docStatus === DocSTATUS.OPEN && (
                  <button
                    type="button"
                    className={styles.fillFromOrderBtn}
                    disabled={!currentValues.orderId || !currentValues.senderId}
                    title={
                      !currentValues.orderId
                        ? 'Сначала выберите заказ'
                        : !currentValues.senderId
                          ? 'Сначала выберите склад отправителя'
                          : 'Заполнить таблицу материалами заказа'
                    }
                    onClick={() =>
                      fillLeaveMaterialFromOrder(
                        currentDocument,
                        setMainData,
                        mainData.users?.user?.token,
                        mainData.reference?.selectedEnterpriseId ??
                          mainData.users?.user?.enterpriseId,
                      )
                    }
                  >
                    Заполнить
                  </button>
                )}
              {documentType === DocumentType.LeaveHalfstuff &&
                currentDocument?.docStatus === DocSTATUS.OPEN && (
                  <button
                    type="button"
                    className={styles.fillFromOrderBtn}
                    disabled={!currentValues.orderId || !currentValues.senderId}
                    title={
                      !currentValues.orderId
                        ? 'Сначала выберите заказ'
                        : !currentValues.senderId
                          ? 'Сначала выберите склад отправителя'
                          : 'Заполнить таблицу полуфабрикатами заказа'
                    }
                    onClick={() =>
                      fillLeaveHalfstuffFromOrder(
                        currentDocument,
                        setMainData,
                        mainData.users?.user?.token,
                        mainData.reference?.selectedEnterpriseId ??
                          mainData.users?.user?.enterpriseId,
                      )
                    }
                  >
                    Заполнить
                  </button>
                )}
            </div>

            {isLeaveOnlyOneMaterial && (
              <div className={styles.linkedSelectBox}>
                <label className={styles.linkedSelectLabel}>Работа</label>
                <select
                  className={styles.linkedSelect}
                  value={currentValues.workId || 0}
                  onChange={handleWorkChange}
                  disabled={!currentValues.orderId}
                >
                  <option value={0}>
                    {currentValues.orderId ? 'Выберите работу' : 'Сначала выберите заказ'}
                  </option>
                  {(leaveOnlyOneMaterialWorks || []).map((work) => (
                    <option key={work.id} value={work.id}>
                      {`${work.workName || 'Работа'} (#${work.id})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

      </div>
      
      {(contentName === DocumentType.ComeMaterial
        || contentName === DocumentType.ComeTovar
        || contentName === DocumentType.LeaveCash
        || contentName === DocumentType.ComeCashFromClients) && (
        <DocInvoiceImage />
      )}

      
      
      <InputInForm 
        nameControl='count' 
        type='number' 
        label={DOC_VALUES_LABELS.COUNT} 
        visible={options.countIsVisible} 
      />

      <InputInForm
        nameControl='remainCount'
        type='number'
        label={DOC_VALUES_LABELS.REMAIN_COUNT}
        visible={isLeaveOnlyOneMaterial}
        disabled
      />

      {!options.tableIsVisible && (
        <>
          <InputInForm 
            nameControl='price' 
            type='number' 
            label={DOC_VALUES_LABELS.PRICE} 
            visible={options.priceIsVisible} 
            isNewDocument
            disabled={options.priceIsDisabled}
          />

          {shouldShowCurrencyFields && (
            <>
              <InputInForm 
                nameControl='currency' 
                type='number' 
                label={options.currencyLabel} 
                visible={options.currencyIsVisible}
                disabled={contentName === DocumentType.Advance && currentDocument?.docValues?.advancePhase === 'ISSUED'}
              />
            
              <InputInForm 
                nameControl='usd' 
                type='number' 
                label={options.usdLabel} 
                visible={options.usdIsVisible}
                disabled={contentName === DocumentType.Advance && currentDocument?.docValues?.advancePhase === 'ISSUED'}
              />
            </>
          )}

          

          <InputInForm 
            nameControl='total' 
            type='number' 
            label={totalLabel} 
            visible={options.totalIsVisible}
            disabled={options.totalIsDisabled || (contentName === DocumentType.Advance && currentDocument?.docValues?.advancePhase === 'ISSUED')}
          />
          
          <InputInForm 
            nameControl='cashFromPartner' 
            type='number' 
            label={options.cashFromPartnerLabel} 
            visible={options.cashFromPartnerVisible}
          />

          

          
        </>
      )}

      {options.tableIsVisible && contentName === DocumentType.AmortizasiyaOS && (
        <button
          type="button"
          style={{ marginBottom: 8, padding: '6px 12px' }}
          onClick={() =>
            fillAmortizasiyaOsTable(
              currentDocument,
              setMainData,
              mainData.users?.user?.token,
              mainData.reference?.selectedEnterpriseId ?? mainData.users?.user?.enterpriseId,
            )
          }
        >
          Тўлдириш (амортизация)
        </button>
      )}

      {contentName === DocumentType.Advance && <AdvanceLinesTable />}

      {options.tableIsVisible && (
        <DocTableCatalog items={currentDocument.docTableItems} typeDocumentByComeOut={typeDocumentByComeOut} />
      )}

      {(contentName === DocumentType.ReceiveToolsFromClient ||
        contentName === DocumentType.ReceiveSubleaseToolsFromClient) && (
        <>
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <CartIco className={styles.toolsPaymentIcoCart} />
                <div className={styles.toolsPaymentTitleText}>Мижоз туловлари</div>
              </div>
            </div>
            {contentName === DocumentType.ReceiveToolsFromClient && <MediatorBonusPreview />}
            <div className={styles.cashBox}>
              <InputInForm
                nameControl="initialPayment"
                type="number"
                label="Накд"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="cashFromPartner"
                type="number"
                label="Пластик"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="currency"
                type="number"
                label="Курс"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="usd"
                type="number"
                label="USD"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="changeToClient"
                type="number"
                label="Кайтим"
                labelPosition="top"
                visible={true}
              />
            </div>
            <div className={styles.debtBox}>
              <InputInForm nameControl="debtSum" type="number" label="Насияга" labelPosition="top" visible={true} />
              <InputInForm nameControl="debtComment" type="text" label="Насия учун изох" labelPosition="top" visible={true} />
            </div>
          </div>
          {contentName === DocumentType.ReceiveToolsFromClient && (
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <div className={styles.toolsPaymentTitleText}>Кушимча хисобланиш</div>
              </div>
            </div>
            <div className={styles.deliveryBox}>
              <InputInForm
                nameControl="deliverySum"
                type="number"
                label="Доставка суммаси"
                labelPosition="top"
                visible={true}
              />
              <SelectDeliverer
                visible={Number(currentDocument?.docValues?.deliverySum || 0) > 0}
              />
              <InputInForm
                nameControl="defectCost"
                type="number"
                label="Брак буйича харажатлар"
                labelPosition="top"
                visible={true}
              />
            </div>
          </div>
          )}
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <div className={styles.toolsPaymentTitleText}>Мижоз хисоб-китоби</div>
              </div>
            </div>
            <ClientOperationsSummary />
          </div>
          {contentName === DocumentType.ReceiveSubleaseToolsFromClient && (
            <div className={styles.toolsPaymentSection}>
              <div className={styles.toolsPaymentTitleBox}>
                <div className={styles.toolsPaymentTitle}>
                  <div className={styles.toolsPaymentTitleText}>
                    Ҳамкор хисоб-китоби:{' '}
                    {(currentDocument?.docTableItems || [])
                      .filter((i: any) => (i.tableType || 'return') === 'return')
                      .reduce(
                        (s: number, i: any) => s + (Number(i.partnerRentSum) || 0),
                        0,
                      )
                      .toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(contentName === DocumentType.TransferToolsToClient ||
        contentName === DocumentType.TransferSubleaseToolsToClient ||
        contentName === DocumentType.SaleTovar ||
        contentName === DocumentType.SaleTools) && (
        <>
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <CartIco className={styles.toolsPaymentIcoCart} />
                <div className={styles.toolsPaymentTitleText}>Мижоз туловлари</div>
              </div>
            </div>
            <div className={styles.cashBox}>
              <InputInForm
                nameControl="initialPayment"
                type="number"
                label="Накд"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="cashFromPartner"
                type="number"
                label="Пластик"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="currency"
                type="number"
                label="Курс"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="usd"
                type="number"
                label="USD"
                labelPosition="top"
                visible={true}
              />
              <InputInForm
                nameControl="changeToClient"
                type="number"
                label="Кайтим"
                labelPosition="top"
                visible={true}
              />
            </div>
          </div>
          {(contentName === DocumentType.TransferToolsToClient ||
            contentName === DocumentType.TransferSubleaseToolsToClient) && (
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <div className={styles.toolsPaymentTitleText}>Кушимча хисобланиш</div>
              </div>
            </div>
            <div className={styles.deliveryBoxTwo}>
              <InputInForm
                nameControl="deliverySum"
                type="number"
                label="Доставка суммаси"
                labelPosition="top"
                visible={true}
              />
              <SelectDeliverer
                visible={Number(currentDocument?.docValues?.deliverySum || 0) > 0}
              />
            </div>
          </div>
          )}
          <div className={styles.toolsPaymentSection}>
            <div className={styles.toolsPaymentTitleBox}>
              <div className={styles.toolsPaymentTitle}>
                <div className={styles.toolsPaymentTitleText}>Мижоз қолдиғи</div>
              </div>
            </div>
            <ClientBalanceInfo />
          </div>
        </>
      )}

      <InputInForm 
        nameControl='comment' 
        type='text' 
        label={DOC_VALUES_LABELS.COMMENT} 
        visible={options.commentIsVisible}
      />

    </div>
  );
});

ValuesSection.displayName = 'ValuesSection';

export default ValuesSection; 