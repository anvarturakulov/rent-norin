import { DocumentModel, Interval, JournalCheckboxs } from '../interfaces/document.interface';
import { ContentType, MessageType } from '../interfaces/general.interface';
import { PereodicModel, ReferenceModel, TypeReference } from '../interfaces/reference.interface';
import { EntryItem, ReportOptions } from '../interfaces/report.interface';
import { User, UserModel, UserName } from '../interfaces/user.interface';
import { PlatformInfo } from '../service/common/platform/platformDetector';
import { Setting, SettingPereodicModel } from '../interfaces/settings.interface';
import { MenuVisibilitySettings } from '../interfaces/enterprise.interface';
import { ReadyRentalOrdersPayload } from '../service/documents/rentalOrders';

export type MinimizedWindowType = 'document' | 'reference' | 'settings' | 'user' | 'enterprise';

export interface InlineCreationEntry {
  typeReference: TypeReference;
  instanceId: string;
  referenceId?: number;
  defaultRefValues?: import('@/app/interfaces/reference.interface').RefValues;
  defaultEnterpriseId?: number | null;
}

export type InlineCreationSlotKey = 'reference.inlineCreation' | 'reference.nestedInlineCreation';

export interface MinimizedWindow {
  id: string;
  type: MinimizedWindowType;
  title: string;
  contentType?: ContentType;
  contentName?: string;
  contentTitle?: string;
  isNew?: boolean;
  data: DocumentModel | ReferenceModel | Setting | UserModel | any;
  minimizedAt: number;
  previousContentName?: string;
  isDuplicateDraft?: boolean;
  comeProductCalculationSignature?: string | null;
}

export interface Maindata {
  document: {
    currentDocument: DocumentModel,
    showDocumentWindow: boolean,
    isNewDocument: boolean,
    showMayda: boolean,
    contentType?: ContentType,
    contentName: string,
    contentTitle: string;
    previousContentName?: string;
    /** Не уходить на главную при закрытии документа, открытого из договора. */
    keepHostPageOnClose?: boolean;
    /** Подпись табличной части ComeProduct после последнего «Рассчитать» (для предупреждения при сохранении). */
    comeProductCalculationSignature?: string | null;
    /** Режим «дубль из журнала»: не сбрасывать docValues как у пустого нового документа. */
    isDuplicateDraft?: boolean;
  },
  reference: {
    currentReference: ReferenceModel | undefined,
    allReferences: Array<ReferenceModel> | undefined,
    showReferenceWindow: boolean,
    isNewReference: boolean;
    selectedEnterpriseId?: number | null;
    inlineCreation?: InlineCreationEntry | null;
    // Второй уровень inline-создания: атрибут (color/shortName/...) поверх inline-формы ТМЗ.
    // Нужен, чтобы родительская форма ТМЗ оставалась смонтированной и не теряла черновик.
    nestedInlineCreation?: InlineCreationEntry | null;
    lastCreatedForInline?: {
      reference: ReferenceModel;
      instanceId: string;
    } | null;
  },
  pereodic: {
    currentPereodic: PereodicModel | undefined,
    showPereodicWindow: boolean,
    isNewPereodic: boolean,
    showPereodicsListWindow: boolean,
    referenceIdForPereodicsList: number,
    referenceNameForPereodicsList: string,
    valueNameForPereodicsList: string,
    valueNameTranslateForPereodicsList: string,
    updateDataForPereodicsList: boolean,
  },
  settings: {
    currentSetting: Setting | undefined,
    allSettings: Array<Setting> | undefined,
        singleEnterpriseMode?: boolean,
        /** Автопроводка внутренних документов при multi-enterprise (см. AVTO_PROVODKA_IN_MANY_ENTERPRISE_MODE на бэкенде) */
        avtoProvodkaInManyEnterpriseMode?: boolean,
        /** Глобальная дата запрета редактирования документов (ISO/Date), одна на все фирмы */
        dateBanEditing?: unknown,
  },
  settingPereodic: {
    currentSettingPereodic: SettingPereodicModel | undefined,
    showSettingPereodicWindow: boolean,
    isNewSettingPereodic: boolean,
    showSettingPereodicsListWindow: boolean,
    settingIdForPereodicsList: number,
    settingKeyForPereodicsList: string,
    /** enterpriseId родительской настройки: null = глобальная periodic, число = на организацию */
    pereodicScopeEnterpriseId: number | null,
    updateDataForSettingPereodicsList: boolean,
  },
  report: {
    reportOption: ReportOptions,
    loading: boolean,
    informData: Array<any>,
    matOborot: Array<any>,
    osOborot: Array<any>,
    oborotka: any,
    personal: any,
    mediatorPersonal: any,
    delivererPersonal: any,
    clients: any,
    aktSverka: any,
    currentDKInnerReportId: number,
    currentDKInnerArrayId: number,
    dashboardCurrentReportType: string,
    dashboardReturnReportType: string | null,
    currentFinancialInnerReportType: string,
    showPereodicListWindow: boolean,
    selectedEnterpriseId: number | null,
  },
  journal: {
    updateDataForDocumentJournal: boolean,
    updateDataForUserJournal: boolean,
    journalChechboxs: JournalCheckboxs,
    updateDataForRefenceJournal: boolean,
    updateDataForSettingsJournal: boolean,
    updateDataForEnterpriseJournal: boolean,
    interval: Interval,
    showIntervalWindow: boolean,
    activeTab?: 'CASH' | 'BANK' | 'USD' | 'PLASTIK',
    /** ID последнего документа с действием (открытие/сохранение/редактирование) — для подсветки в журнале */
    lastActedDocumentId?: number | null,
    /** Одноразовый флаг: перелистнуть пагинацию на страницу с lastActedDocumentId */
    navigateToLastActedDocument?: boolean,
  },
  window: {
    showMessageWindow: boolean,
    message: string | Array<EntryItem>,
    messageType: MessageType,
    activeMenuKey: string,
    clearControlElements: boolean,
    showSettingsWindow: boolean,
    isNewSetting: boolean,
    mainPage: boolean,
    uploadingDashboard: boolean,
    showPaymentLessThanIncomeModal?: boolean,
    rentalReadyOrders?: ReadyRentalOrdersPayload | null,
    showReadyRentalOrdersModal?: boolean,
  },
  users: {
    currentUser: UserModel | undefined,
    user: User | undefined,
    usersName: [UserName] | undefined,
    showUserWindow: boolean,
    isNewUser: boolean,
  },
  enterprises: {
    currentEnterprise: any | undefined,
    showEnterpriseWindow: boolean,
    isNewEnterprise: boolean,
  },
  enterpriseSettings: {
    menuVisibility: MenuVisibilitySettings | undefined,
  },
  platform: {
    info: PlatformInfo | undefined
  },
  minimizedWindows: MinimizedWindow[];
}

export interface IAppContext {
  mainData: Maindata,
  setMainData: (key: string, value: any) => void;
};