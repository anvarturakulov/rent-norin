import { DatesForDuplicateDocs, DocSTATUS, DocTableItem, DocumentModel, DocValues, Interval, JournalCheckboxs, DocumentType } from '../interfaces/document.interface'
import { ReportOptions, Schet } from '../interfaces/report.interface'
import { PereodicModel } from '../interfaces/reference.interface'
import { SettingPereodicModel } from '../interfaces/settings.interface'
import { getMonthStartToCurrentDayRange, getTodayRange } from '../service/common/dateRanges'

export const defaultDocumentTableItem: DocTableItem = {
    analiticId: -1,
    balance: 0,
    count: 0,
    price: 0,
    total: 0,
    costTotal: 0,
    costPrice: 0,
    hourlyTariff: 0,
    dailyRent: 0,
}

export const defaultDocValue: DocValues = {
    senderId: 0,
    receiverId: 0,
    analiticId: 0,
    productForChargeId:0,
    isWorker: false,
    isMediator: false,
    isDeliverer: false,
    isPartner: false,
    isClient: false,
    isDepartment: false,
    isFounder: false,
    count: 0,
    price: 0,
    total: 0,
    comment: '',
    finPerson: '',
    driver: '',
    carId: 0,
    senderPersonId: 0,
    remainCount: 0,
    orderId: 0,
    workId: 0,
}

export const defaultDocument:DocumentModel = {
    id: -1,
    date: 0,
    documentType: DocumentType.Error,
    userId: 0,
    docStatus: DocSTATUS.OPEN,
    docValues: {...defaultDocValue},
    docTableItems: [],
}

const defaultDateRange = getMonthStartToCurrentDayRange();
const defaultTodayRange = getTodayRange();

export const defaultReportOptions: ReportOptions = {
    startDate: defaultDateRange.start,
    endDate: defaultDateRange.end,
    showReport: false,
    startReport: false,
    schet: Schet.S20,
}

export const defaultInterval: Interval = {
    dateStart: defaultTodayRange.start,
    dateEnd: defaultTodayRange.end,
}

export const defaultDatesForDuplicateDocs:DatesForDuplicateDocs = {
    dateFrom: 0,
    dateTo: 0
}

export const defaultJournalCheckbox:JournalCheckboxs = {
    charges: false,
    workers: false,
    mediators: false,
    deliverers: false,
    partners: false,
    clients: false,
    departments: false,
    order: false,
    pendingApproval: false,
}

export const defaultPereodic:PereodicModel = {
    id: 0,
    referenceId: 0,
    name: '',
    value: 0,
    date: 0
}

export const defaultSettingPereodic: SettingPereodicModel = {
    id: 0,
    settingId: 0,
    value: 0,
    date: 0,
}