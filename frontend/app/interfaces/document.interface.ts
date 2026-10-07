import { TypeReference } from './reference.interface'
import { Enterprise } from './enterprise.interface'
import type { FormworkLayout } from '@/app/service/formwork/formwork.types'

export enum DocSTATUS {
    OPEN = 'OPEN',
    PENDING = 'PENDING',
    PROVEDEN = 'PROVEDEN',
    REJECTED = 'REJECTED',
    DELETED = 'DELETED'
}

/** Тип часового тарифа аренды инструментов: наличка / физ.лицо или перечисление. */
export enum RentTariffType {
    CASH = 'CASH',
    TRANSFER = 'TRANSFER',
}

export enum DocumentType {

    ComeMaterial = 'ComeMaterial',
    ComeProduct = 'ComeProduct',
    ComeHalfstuff = 'ComeHalfstuff',

    SaleProd = 'SaleProd',
    SaleMaterial = 'SaleMaterial',
    SaleHalfStuff = 'SaleHalfStuff',

    LeaveProd = 'LeaveProd',
    LeaveMaterial = 'LeaveMaterial',
    LeaveOnlyOneMaterial = 'LeaveOnlyOneMaterial',
    LeaveHalfstuff = 'LeaveHalfstuff',

    MoveProd = 'MoveProd',
    MoveMaterial = 'MoveMaterial',
    MoveHalfstuff = 'MoveHalfstuff',

    ComeTools = 'ComeTools',
    MoveTools = 'MoveTools',
    LeaveTools = 'LeaveTools',
    SaleTools = 'SaleTools',

    ComeTovar = 'ComeTovar',
    LeaveTovar = 'LeaveTovar',
    SaleTovar = 'SaleTovar',

    TransferToolsToClient = 'TransferToolsToClient',
    OrderToolsToClient = 'OrderToolsToClient',
    ReceiveToolsFromClient = 'ReceiveToolsFromClient',
    TransferSubleaseToolsToClient = 'TransferSubleaseToolsToClient',
    ReceiveSubleaseToolsFromClient = 'ReceiveSubleaseToolsFromClient',

    ComeOS = 'ComeOS',
    LeaveOS = 'LeaveOS',
    MoveOS = 'MoveOS',
    SaleOS = 'SaleOS',
    AmortizasiyaOS = 'AmortizasiyaOS',

    ComeCashFromClients = 'ComeCashFromClients',
    MoveCash = 'MoveCash',
    LeaveCash = 'LeaveCash',
    Advance = 'Advance',
    ZpCalculate = 'ZpCalculate',
    TakeProfit = 'TakeProfit',

    ServicesFromPartners = 'ServicesFromPartners',
    ServicesToClients = 'ServicesToClients',

    GateIncome = 'GateIncome', // Накладная для входа

    Error = 'Error'
}

export interface DocTableItem {
    analiticId: number,
    refCountInBox?: number,   // Количество в коробке
    balance: number,
    count: number,
    price: number,
    total: number,
    costPrice: number,     // Себестоимость единицы товара
    costTotal: number,     // Общая себестоимость (costPrice * count)
    countByBox?: number,  
    unit?: string, // Единица измерения
    tableType?: 'income' | 'expense' | 'return' | 'brak' | 'sale' | 'tovar',
    /** План списания из заказа (для LeaveMaterial fill); не участвует в проводках */
    plannedCount?: number,
    hourlyTariff?: number,
    dailyRent?: number,
    sourceTransferDocId?: number,
    rentSum?: number,
    partnerHourlyTariff?: number,
    partnerRentSum?: number,
    rentHours?: number,
    settlementDate?: number,
    lineKind?: string,
    lineStorageId?: number,
}

export interface ReceiveToolsPreviewRow {
    analiticId: number;
    count: number;
    price: number;
    total: number;
    costPrice: number;
    costTotal: number;
    balance: number;
    hourlyTariff: number;
    rentSum: number;
    partnerHourlyTariff?: number;
    partnerRentSum?: number;
    sourceTransferDocId: number;
    settlementDate: number;
    transferDocNumber: string;
    tableType: 'return';
}

export interface TransferToolsPreviewRow {
    analiticId: number;
    count: number;
    balance: number;
    costPrice: number;
    costTotal: number;
    price: number;
    total: number;
    /** Часовой тариф аренды (периодика firstPrice или thirdPrice по типу тарифа). */
    hourlyTariff: number;
}

export interface DocValues {
    senderId: number,
    receiverId: number,
    analiticId?: number,
    productForChargeId?: number,
    isWorker?: boolean,
    isMediator?: boolean,
    isDeliverer?: boolean,
    isPartner?: boolean,
    isClient?: boolean,
    isDepartment?: boolean,
    isFounder?: boolean,
    count: number,
    price: number,
    total: number,
    cashFromPartner?: number,
    comment?: string,
    currency?: number,
    usd?: number,
    finPerson?: string,
    driver?: string,
    carId?: number,
    senderPersonId?: number,
    remainCount?: number,
    deadlineDate?: number,
    exitCompleted?: boolean,
    incomeCompleted?: boolean,
    initialPayment?: number,
    contractNumber?: string, // Номер договора
    settlementDate?: number,
    /** CASH = firstPrice, TRANSFER = thirdPrice. Пусто = CASH. */
    rentTariffType?: RentTariffType | string,
    /** Чертёж фундамента и результат расчёта опалубки */
    formworkLayout?: FormworkLayout | null,
    mediatorId?: number,
    partnerId?: number,
    delivererId?: number,
    deliverySum?: number,
    defectCost?: number,
    returnDateTime?: number,
    cashReceived?: number,
    plasticReceived?: number,
    changeToClient?: number,
    debtSum?: number,
    debtComment?: string,
    materialResponsiblePersonId?: number, // ID материально ответственного лица
    invoiceImagePath?: string,
    invoiceImagePath2?: string,
    invoiceImagePath3?: string,
    orderId?: number,
    workId?: number,
    clientContractId?: number | null,
    clientContractLineId?: number | null,
    /** Топшириш создан из буюртмы */
    sourceRentalOrderDocId?: number | null,
    /** Буюртма закрыта этим топшириш */
    fulfilledByTransferDocId?: number | null,
    /** DRAFT | ISSUED | CLOSED */
    advancePhase?: string | null,
}

export const isToolsOrderDocument = (
  documentType?: DocumentType | string | null,
): boolean => documentType === DocumentType.OrderToolsToClient;

export interface DocumentModel {
    id?: number,
    date: number,
    userId: number,
    documentType: DocumentType,
    docStatus: DocSTATUS,
    docValues: DocValues
    docTableItems: Array<DocTableItem>,
    enterpriseId?: number | null,
    enterprise?: Enterprise | null,
    isInterEnterprise?: boolean,
    sourceEnterpriseId?: number | null,
    sourceEnterprise?: Enterprise | null,
    targetEnterpriseId?: number | null,
    targetEnterprise?: Enterprise | null,
    documentTypeForSender?: DocumentType | null,
    documentTypeForReceiver?: DocumentType | null,
    isLocked?: boolean,
    rejectionReason?: string | null,
};

export interface OptionsForDocument {
    senderType: TypeReference,
    senderLabel: string,
    senderIsVisible: boolean,

    receiverType: TypeReference,
    receiverLabel: string,
    recieverIsVisible: boolean

    analiticType: TypeReference,
    analiticLabel: string,
    analiticIsVisible: boolean

    productForChargeType: TypeReference,
    productForChargeLabel: string,
    productForChargeIsVisible: boolean

    cashFromPartnerLabel: string,
    cashFromPartnerVisible: boolean,

    currencyIsVisible: boolean,
    usdIsVisible: boolean,
    currencyLabel: string,
    usdLabel: string,

    tableIsVisible: boolean,
    countIsVisible: boolean,
    priceIsVisible: boolean,
    totalIsVisible: boolean,
    priceIsDisabled: boolean,
    totalIsDisabled: boolean,
    balansIsVisible: boolean,
    commentIsVisible: boolean,
    finPersonIsVisible: boolean,
    driverIsVisible: boolean,
    senderPersonIsVisible: boolean,
    carIsVisible: boolean,
    carType: TypeReference,
    carLabel: string,
    senderPersonType: TypeReference,
    senderPersonLabel: string,
    materialResponsiblePersonIsVisible: boolean,
    materialResponsiblePersonType: TypeReference,
    materialResponsiblePersonLabel: string,
} 

export type DocumentTypeForReference = 'MATERIAL' | 'PRODUCT' | 'HALFSTUFF' | 'OS' | 'TOOLS' | 'TOVAR' | 'OTHER'

export interface Interval {
    dateStart: number,
    dateEnd: number
}

export interface DatesForDuplicateDocs {
    dateFrom: number,
    dateTo: number
}

export type NameControl = 'count' | 'price' | 'total' |
                          'comment' | 'cashFromPartner' | 
                          'balance' | 'currency' | 'usd' | 
                          'finPerson' | 'driver' | 'deadlineDate' | 'initialPayment' | 'contractNumber' | 'remainCount' |
                          'cashReceived' | 'plasticReceived' | 'changeToClient' | 'debtSum' | 'debtComment' | 'deliverySum' | 'defectCost'

export type NameDocs = 'sd' | 'ds'

export interface JournalCheckboxs {
    charges: boolean,
    workers: boolean,
    mediators: boolean,
    deliverers: boolean,
    partners: boolean,
    clients: boolean,
    departments: boolean,
    order: boolean,
    pendingApproval: boolean,
}   

export type TypeDocumentByComeOut = 'come' | 'out'

// Функция для определения схемы на основе типа документа
export const getSchetForDocumentType = (documentType: DocumentType): string => {
  switch (documentType) {
    case DocumentType.ComeMaterial:
    case DocumentType.SaleMaterial:
    case DocumentType.LeaveMaterial:
    case DocumentType.LeaveOnlyOneMaterial:
    case DocumentType.MoveMaterial:
      return 'S10'; // Материалы

    case DocumentType.ComeTools:
    case DocumentType.LeaveTools:
    case DocumentType.MoveTools:
    case DocumentType.SaleTools:
    case DocumentType.TransferToolsToClient:
    case DocumentType.OrderToolsToClient:
      return 'S11'; // Инструменты на складе

    case DocumentType.TransferSubleaseToolsToClient:
    case DocumentType.ReceiveSubleaseToolsFromClient:
      return 'S13'; // Инструменты субаренды (у партнёра)

    case DocumentType.ComeTovar:
    case DocumentType.LeaveTovar:
    case DocumentType.SaleTovar:
      return 'S29'; // Товары

    case DocumentType.ComeOS:
    case DocumentType.SaleOS:
    case DocumentType.LeaveOS:
    case DocumentType.MoveOS:
    case DocumentType.AmortizasiyaOS:
      return 'S01'; // Основные средства
    
    case DocumentType.SaleProd:
    case DocumentType.LeaveProd:
    case DocumentType.MoveProd:
    case DocumentType.ComeProduct:
      return 'S28'; // Готовая продукция
    
    case DocumentType.LeaveHalfstuff:
    case DocumentType.ComeHalfstuff:
    case DocumentType.MoveHalfstuff:
    case DocumentType.SaleHalfStuff:
      return 'S21'; // Полуфабрикаты собственного производства
    
    default:
      return 'S29'; // По умолчанию для товаров
  }
}


// Helper функции для работы с двумя таблицами
export const getReturnItems = (docTableItems: DocTableItem[]): DocTableItem[] =>
  docTableItems.filter((item) => !item.tableType || item.tableType === 'return');

export const getBrakItems = (docTableItems: DocTableItem[]): DocTableItem[] =>
  docTableItems.filter((item) => item.tableType === 'brak');

export const getSaleItems = (docTableItems: DocTableItem[]): DocTableItem[] =>
  docTableItems.filter((item) => item.tableType === 'sale');

export const getTovarItems = (docTableItems: DocTableItem[]): DocTableItem[] =>
  docTableItems.filter((item) => item.tableType === 'tovar');

export const shouldShowReceiveToolsTables = (documentType: DocumentType): boolean =>
  documentType === DocumentType.ReceiveToolsFromClient ||
  documentType === DocumentType.ReceiveSubleaseToolsFromClient;

/** Обычный возврат ускун или возврат субаренды (общая таблица / пересчёт аренды). */
export const isReceiveToolsDocument = (
  documentType: DocumentType | string | undefined | null,
): boolean =>
  documentType === DocumentType.ReceiveToolsFromClient ||
  documentType === DocumentType.ReceiveSubleaseToolsFromClient;

/** Документы со списанием материалов в отдельной нижней таблице (expense) */
export const shouldShowMaterialsExpenseTable = (documentType: DocumentType): boolean =>
  documentType === DocumentType.LeaveTools ||
  documentType === DocumentType.LeaveTovar;

/** Все строки основной таблицы LeaveMaterial (income, expense и без tableType) */
export const getLeaveMaterialCatalogItems = (docTableItems: DocTableItem[]): DocTableItem[] =>
  docTableItems.filter(
    (item) =>
      item.tableType !== 'return' &&
      item.tableType !== 'brak' &&
      item.tableType !== 'sale' &&
      item.tableType !== 'tovar',
  );

export const getReceiveToolsTableItems = (
  docTableItems: DocTableItem[] | undefined,
): DocTableItem[] => {
  if (!docTableItems?.length) return [];
  return [
    ...getReturnItems(docTableItems),
    ...getBrakItems(docTableItems),
    ...getSaleItems(docTableItems),
    ...getTovarItems(docTableItems),
  ];
};

/** Нормализует порядок строк: return → brak → sale → tovar */
export const normalizeReceiveToolsTableOrder = (
  docTableItems: DocTableItem[] | undefined,
): DocTableItem[] | undefined => {
  if (!docTableItems?.length) return docTableItems;
  return [
    ...getReturnItems(docTableItems),
    ...getBrakItems(docTableItems),
    ...getSaleItems(docTableItems),
    ...getTovarItems(docTableItems),
  ];
};

export const getIncomeItems = (docTableItems: DocTableItem[]): DocTableItem[] => {
  return docTableItems.filter(item => {
    if (
      item.tableType === 'return' ||
      item.tableType === 'brak' ||
      item.tableType === 'sale' ||
      item.tableType === 'tovar'
    ) {
      return false;
    }
    return !item.tableType || item.tableType === 'income';
  });
}

export const getExpenseItems = (docTableItems: DocTableItem[]): DocTableItem[] => {
  return docTableItems.filter(item => item.tableType === 'expense');
}

/** @deprecated Двойные таблицы для ComeProduct/ComeHalfstuff больше не используются */
export const normalizeDocTableItemsOrderForDualTables = (
  docTableItems: DocTableItem[] | undefined,
  _documentType?: DocumentType
): DocTableItem[] | undefined => {
  return docTableItems;
};

// Функция проверки, нужно ли показывать две таблицы для документа
export const shouldShowDualTables = (_documentType: DocumentType): boolean => {
  return false;
}

export const documentsWithTableItems = [
  `${DocumentType.ComeMaterial}`,
  `${DocumentType.LeaveMaterial}`,
  `${DocumentType.LeaveProd}`,
  `${DocumentType.LeaveHalfstuff}`,
  `${DocumentType.MoveProd}`,
  `${DocumentType.MoveMaterial}`,
  `${DocumentType.MoveHalfstuff}`,
  `${DocumentType.ComeTools}`,
  `${DocumentType.LeaveTools}`,
  `${DocumentType.MoveTools}`,
  `${DocumentType.SaleTools}`,
  `${DocumentType.ComeTovar}`,
  `${DocumentType.LeaveTovar}`,
  `${DocumentType.SaleTovar}`,
  `${DocumentType.TransferToolsToClient}`,
  `${DocumentType.OrderToolsToClient}`,
  `${DocumentType.ReceiveToolsFromClient}`,
  `${DocumentType.TransferSubleaseToolsToClient}`,
  `${DocumentType.ReceiveSubleaseToolsFromClient}`,
  `${DocumentType.SaleHalfStuff}`,
  `${DocumentType.SaleMaterial}`,
  `${DocumentType.SaleProd}`,
  `${DocumentType.ComeOS}`,
  `${DocumentType.LeaveOS}`,
  `${DocumentType.MoveOS}`,
  `${DocumentType.SaleOS}`,
  `${DocumentType.AmortizasiyaOS}`,
]

export const documentsWithOwnPrice = [
  `${DocumentType.ComeMaterial}`,
  `${DocumentType.ComeTools}`,
  `${DocumentType.ComeTovar}`,
  `${DocumentType.SaleProd}`,
  `${DocumentType.SaleTovar}`,
  `${DocumentType.SaleTools}`,
  `${DocumentType.SaleHalfStuff}`,
  `${DocumentType.SaleMaterial}`,
  `${DocumentType.ComeOS}`,
  `${DocumentType.SaleOS}`,
]

// Функция для проверки, должен ли документ ComeProduct иметь редактируемую цену на основе даты
export const shouldComeProductHaveEditablePrice = (documentDate?: number): boolean => {
  return documentDate ? documentDate < 1735671599000 : false;
}



