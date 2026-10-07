import { DocumentType } from "./document.interface";

export enum ReportType {
  MatOborot = "MatOborot",
  Oborotka = "Oborotka",
  Personal = "Personal",
  MediatorPersonal = "MediatorPersonal",
  DelivererPersonal = "DelivererPersonal",
  AktSverka = "AktSverka",
  OsOborot = "OsOborot",
}

export enum Schet {
  S00 = "S00", // СЧЕТА ДЛЯ ВВОДА ОСТАТКОВ И ЗАКРЫТИЯ ЗП
  S01 = "S01", // СЧЕТА УЧЕТА ОСНОВНЫХ СРЕДСТВ
  S02 = "S02", // НАКОПЛЕННАЯ АМОРТИЗАЦИЯ ОС
  S10 = "S10", // СЧЕТА УЧЕТА МАТЕРИАЛОВ
  S11 = "S11", // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ НА СКЛАДЕ
  S12 = "S12", // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ У КЛИЕНТА (В АРЕНДЕ)
  S13 = "S13", // СЧЕТА УЧЕТА ИНСТРУМЕНТОВ СУБАРЕНДЫ (У ПАРТНЁРА / ВЫДАНО КЛИЕНТУ)
  S20 = "S20", // СЧЕТА УЧЕТА ОСНОВНОГО ПРОИЗВОДСТВА И СЧЕТА УЧЕТА РАСХОДОВ ПЕРИОДА
  S21 = "S21", // СЧЕТА УЧЕТА ПОЛУФАБРИКАТОВ СОБСТВЕННОГО ПРОИЗВОДСТВА
  S23 = "S23", // СЧЕТ УЧЕТА ВСПОМОГАТЕЛЬНОГО ПРОИЗВОДСТВА
  S28 = "S28", // СЧЕТА УЧЕТА ГОТОВОЙ ПРОДУКЦИИ
  S29 = "S29", // СЧЕТА УЧЕТА ТОВАРОВ
  S40 = "S40", // СЧЕТА К ПОЛУЧЕНИЮ ОТ КЛИЕНТОВ
  S41 = "S41", // СЧЕТА К ПОЛУЧЕНИЮ ОТ ЗАКАЗЧИКОВ
  S50 = "S50", // СЧЕТА УЧЕТА ДЕНЕЖНЫХ СРЕДСТВ В КАССЕ
  S51 = "S51", // СЧЕТА УЧЕТА ДЕНЕЖНЫХ СРЕДСТВ НА РАСЧЕТНОМ СЧЕТЕ
  S60 = "S60", // СЧЕТА К ОПЛАТЕ ПОСТАВЩИКАМ И ПОДРЯДЧИКАМ
  S64 = "S64", // СЧЕТА УЧЕТА РАСЧЕТОВ С ДОСТАВЩИКАМИ
  S66 = "S66", // СЧЕТА К ПОЛУЧЕНИЕ ОТ УЧРИДИТЕЛEЙ
  S67 = "S67", // СЧЕТА УЧЕТА ЗАРОБОТНОЙ ПЛАТЫ СОТРУДНИКОВ
  S71 = "S71", // СЧЕТА УЧЕТА ПОДОТЧЁТНЫХ СУММ (ЖАВОБГАР ШАХС)
  S65 = "S65", // СЧЕТА УЧЕТА БОНУСОВ ПОСРЕДНИКОВ (ВОСИТАЧИЛАР)
  S68 = "S68", // КОШЕЛКИ УЧРИДИТЕЛЕЙ,
  S90 = "S90", // СЧЕТА УЧЕТА ДОХОДОВ
  S91 = "S91", // СЧЕТА УЧЕТА РАСХОДОВ
  S93 = "S93", // ПРОЧИЕ ДОХОДЫ (БОШҚА ДАРОМАД)
}

export interface EntryItem {
  date: number;
  docId: number;
  documentType: DocumentType;
  debet: Schet;
  debetFirstSubcontoId: number;
  debetSecondSubcontoId: number;
  debetThirdSubcontoId: number;
  kredit: Schet;
  kreditFirstSubcontoId: number;
  kreditSecondSubcontoId: number;
  kreditThirdSubcontoId: number;
  count: number;
  summa: number;
  description: string;
}

export enum DEBETKREDIT {
  DEBET = "DEBET",
  KREDIT = "KREDIT",
}

export enum TypeQuery {
  POSUM = "POSUM",
  POKOL = "POKOL",
  TDSUM = "TDSUM",
  TDKOL = "TDKOL",
  TKSUM = "TKSUM",
  TKKOL = "TKKOL",
  KOSUM = "KOSUM",
  KOKOL = "KOKOL",
  COUNTCOME = "COUNTCOME",
  TOTALCOME = "TOTALCOME",
  COUNTLEAVE = "COUNTLEAVE",
  TOTALLEAVE = "TOTALLEAVE",
  TDSUMEntrys = "TDSUMEntrys",
  TKSUMEntrys = "TKSUMEntrys",
  AllEntrys = "AllEntrys",
  ODS = "ODS",
  ODU = "ODU",
  OKS = "OKS",
  OKU = "OKU",
  ODK = "ODK",
  OKK = "OKK",
  OK = "OK",
  OS = "OS",
  OU = "OU",
  POUSD = "POUSD",
  KOUSD = "KOUSD",
  TDUSD = "TDUSD",
  TKUSD = "TKUSD",
  TOTALCOMEUSD = "TOTALCOMEUSD",
  TOTALLEAVEUSD = "TOTALLEAVEUSD",
}

export interface QuerySimple {
  reportType: string | null;
  typeQuery: TypeQuery | null;
  sectionId: number | null;
  tmzId: number | null;
  schet: Schet | null;
  dk: string | null;
  workerId: number | null;
  name: string | null;
  startDate: number | null;
  endDate: number | null;
  firstSubcontoId: number | null;
  secondSubcontoId: number | null;
  thirdSubcontoId: number | null;
  debetFirstSubcontoId: number | null;
  debetSecondSubcontoId: number | null;
  debetThirdSubcontoId: number | null;
  kreditFirstSubcontoId: number | null;
  kreditSecondSubcontoId: number | null;
  kreditThirdSubcontoId: number | null;
  partnerType: string | null; // Новое поле для типа партнера
  reportYear: number | null;
  enterpriseId: number | null; // ID предприятия для фильтрации отчетов
}

export interface QueryOperationsBySchet {
  startDate: number | null;
  endDate: number | null;
  schet: Schet | null;
  firstSubcontoId: number | null;
  secondSubcontoId: number | null;
  thirdSubcontoId: number | null;
  enterpriseId?: number | null; // ID предприятия для фильтрации проводок
  includeDocumentUser?: boolean;
}

export interface QueryWorker {
  startDate: number;
  endDate: number;
  workerId: number;
  name: string;
}
