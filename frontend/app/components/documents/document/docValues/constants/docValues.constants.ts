import { DocumentType } from '@/app/interfaces/document.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
  
export const DOC_VALUES_LABELS = {
  WORKER: 'Ходим',
  MEDIATOR: 'Воситачи',
  DELIVERER: 'Доставщик',
  PARTNER: 'Таъминотчи',
  CLIENT: 'Клиент',
  FOUNDER: 'Таъсисчи',
  DEPARTMENT: 'Ички корхона',
  LOAD_BALANCE: 'Колдик на нархларни юклаш',
  BALANCE: 'Колдик',
  COUNT: 'Сон',
  PRICE: 'Нарх',
  TOTAL: 'Сумма',
  PRODUCT_TOTAL: 'Махсулот суммаси',
  COMMENT: 'Изох',
  FIN_PERSON: 'Жавобгар шахс',
  DRIVER: 'Хайдовчи',
  REMAIN_COUNT: 'Колдик'
} as const;

export const DOCUMENT_TYPE_CHECKS = {
  HAS_WORKERS: (contentName: string) =>
    contentName === DocumentType.LeaveCash ||
    contentName === DocumentType.SaleMaterial,
  HAS_MEDIATORS: (contentName: string) => contentName === DocumentType.LeaveCash,
  HAS_DELIVERERS: (contentName: string) => contentName === DocumentType.LeaveCash,
  HAS_PARTNERS: (contentName: string) =>
    contentName === DocumentType.LeaveCash ||
    contentName === DocumentType.ComeCashFromClients ||
    contentName === DocumentType.SaleMaterial,
  HAS_CLIENTS: (contentName: string) =>
    contentName === DocumentType.LeaveCash ||
    contentName === DocumentType.SaleMaterial,
  HAS_FOUNDERS: (contentName: string) => contentName === DocumentType.LeaveCash,
  HAS_DEPARTMENTS: (contentName: string) => 
    (
      // contentName === DocumentType.LeaveCash || 
      // contentName === DocumentType.ComeCashFromClients ||
      // contentName === DocumentType.ComeMaterial ||
      contentName === DocumentType.SaleProd
      // contentName === DocumentType.ServicesFromPartners
    )
} as const;

export const ROLE_PERMISSIONS = {
  ADMIN: [UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY],
  GLAVBUX: [UserRoles.GLAVBUX],
} as const;

export const DOCUMENT_TYPES = {
  ZP_CALCULATE: DocumentType.ZpCalculate,
  COME_MATERIAL: DocumentType.ComeMaterial,
  COME_HALFSTUFF: DocumentType.ComeHalfstuff,
  LEAVE_CASH: DocumentType.LeaveCash,
  LEAVE_MATERIAL: DocumentType.LeaveMaterial,
  LEAVE_ONLY_ONE_MATERIAL: DocumentType.LeaveOnlyOneMaterial,
  LEAVE_HALFSTUFF: DocumentType.LeaveHalfstuff,
  SALE_PROD: DocumentType.SaleProd
} as const; 