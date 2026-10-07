export enum TypeReference {
  CHARGES = "CHARGES",
  SERVICES = "SERVICES",
  PARTNERS = "PARTNERS",
  PRICES = "PRICES",
  STORAGES = "STORAGES",
  TMZ = "TMZ",
  WORKS = "WORKS",
  COMMON_WORKS = "COMMON_WORKS",
  WORKERS = "WORKERS",
  CARS = "CARS",
  WORK_TYPES = "WORK_TYPES",
  APARTMENTS = "APARTMENTS",
  WORK_ITEMS = "WORK_ITEMS",
  TMZ_SHORT_NAME = "TMZ_SHORT_NAME",
  TMZ_SIZE = "TMZ_SIZE",
  TMZ_COLOR = "TMZ_COLOR",
  TMZ_TEXTURE = "TMZ_TEXTURE",
  TMZ_MANUFACTURE = "TMZ_MANUFACTURE",
  TMZ_UNIT = "TMZ_UNIT",
  MEDIATORS = "MEDIATORS",
  DELIVERERS = "DELIVERERS",
}

/** Справочники значений реквизитов ТМЗ */
export const TMZ_ATTRIBUTE_DICTIONARY_TYPES: TypeReference[] = [
  TypeReference.TMZ_SHORT_NAME,
  TypeReference.TMZ_SIZE,
  TypeReference.TMZ_COLOR,
  TypeReference.TMZ_TEXTURE,
  TypeReference.TMZ_MANUFACTURE,
  TypeReference.TMZ_UNIT,
];

export function isTmzAttributeDictionaryType(
  typeReference: TypeReference,
): boolean {
  return TMZ_ATTRIBUTE_DICTIONARY_TYPES.includes(typeReference);
}

export enum TypePartners {
  CLIENTS = "CLIENTS",
  DEPARTMENTS = "DEPARTMENTS",
  SUPPLIERS = "SUPPLIERS",
}

export enum TypeMediator {
  DRIVER = "DRIVER", // Шофёр
  MASTER = "MASTER", // Мастер
}

export enum TypeTMZ {
  PRODUCT = "PRODUCT",
  HALFSTUFF = "HALFSTUFF",
  MATERIAL = "MATERIAL",
  OS = "OS",
  TOOLS = "TOOLS", // Инструменты (аренда)
  TOVAR = "TOVAR", // Товары
}

/** Роль элемента в системе опалубки (TMZ TOOLS) */
export enum FormworkKind {
  PANEL = "PANEL", // Щит
  CORNER_OUTER = "CORNER_OUTER", // Внешний угол
  CORNER_INNER = "CORNER_INNER", // Внутренний угол
  LOCK = "LOCK", // Замок (на стык)
  BRACE = "BRACE", // Подкос (на метр контура)
  TIE = "TIE", // Стяжка (на щит)
}

export enum TypeSECTION {
  COMMON = "COMMON",
  CASH = "CASH",
  BANK = "BANK",
  PLASTIK = "PLASTIK",
  FOUNDER = "FOUNDER",
  PRODUCTION = "PRODUCTION",
  STORAGE = "STORAGE",
  PARTNER_TOOLS = "PARTNER_TOOLS",
}

export enum CarType {
  VIP = "VIP",
  OWN = "OWN",
  STRANGER = "STRANGER",
}

export enum ProductionType {
  PB_PLITA = "PB_PLITA", // ПБ Плита - расчет по метрам
  PK_PLITA = "PK_PLITA", // ПК Плита - расчет по штукам
  BETON = "BETON", // Бетон - расчет по количеству
  OTHER = "OTHER", // Прочие - расчет по количеству
}

export enum PriceClass {
  A = "A",
  B = "B",
  C = "C",
}

export interface RefValues {
  clientForSectionId?: number;
  clientForSectionOldId: string;
  partnerId?: number;
  typePartners?: TypePartners;
  referredByMediatorId?: number;
  isMediatorDriver?: boolean;
  isMediatorMaster?: boolean;
  isIndividualPerson?: boolean;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  isLegalEntity?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankMfo?: string;
  typeTMZ?: TypeTMZ;
  mediatorType?: TypeMediator;
  typeSection?: TypeSECTION;
  unit?: string;
  comment?: string;
  markToDeleted?: boolean;
  importedFromXlsx?: boolean;
  norma?: number;
  un?: boolean;
  longCharge?: boolean;
  shavkatCharge?: boolean;
  firstPrice?: number;
  secondPrice?: number;
  thirdPrice?: number;
  telegramId?: string;
  imagePath?: string;
  remainInStart?: number;
  costPriceInStart?: number;
  gruppaArtikul?: string;
  ostatokNaNachalo?: number;
  ostatokSumma?: number;
  isForeign?: boolean;
  address?: string;
  phone?: string;
  phone2?: string;
  contactName1?: string;
  contactName2?: string;
  inn?: string;
  jshshir?: string;
  carModel?: string;
  carType?: CarType;
  autoAcceptInterEnterprise?: boolean;
  isOffice?: boolean;
  productionType?: ProductionType;
  /** Класс цен готовой продукции */
  priceClass?: PriceClass;
  productMetr?: number;
  superKassir?: boolean;
  hasBuxgalter?: boolean;
  isMainWarehouse?: boolean;
  isDefectWarehouse?: boolean;
  isMagazine?: boolean;
  showOnWebsite?: boolean;
  websiteDescription?: string;
  imagePath2?: string;
  imagePath3?: string;
  tmzWorks?: unknown[];
  tmzMaterials?: unknown[];
  tmzTechMap?: unknown[];
  tmzComponents?: unknown[];
  tmzPricing?: Record<string, unknown>;
  filesFromScaling?: unknown[];
  filesFromDrawing?: unknown[];
  workDeptId?: number;
  /** Краткое наименование ТМЗ */
  shortName?: string;
  /** ID справочника TMZ_SHORT_NAME */
  shortNameId?: number;
  /** Размер */
  size?: string;
  /** ID справочника TMZ_SIZE */
  sizeId?: number;
  /** Цвет */
  color?: string;
  /** ID справочника TMZ_COLOR */
  colorId?: number;
  /** Текстура */
  texture?: string;
  /** ID справочника TMZ_TEXTURE */
  textureId?: number;
  /** Производитель */
  manufacture?: string;
  /** ID справочника TMZ_MANUFACTURE */
  manufactureId?: number;
  /** Листовой материал (раскрой по размерам) */
  isSheetMaterial?: boolean;
  /** Инструмент субаренды (партнёрский) */
  isSubleaseTool?: boolean;
  /** Роль элемента опалубки */
  formworkKind?: FormworkKind | null;
  /** Норма расхода комплектующих опалубки */
  formworkNorm?: number | null;
  /** Высота листового материала, мм */
  height?: number;
  /** Ширина листового материала, мм */
  width?: number;
  /** Площадь листового материала, м² */
  area?: number;
  /** Производственные цеха, где может использоваться материал */
  allowedProductionDeptIds?: number[] | null;
  /** Годовой коэффициент амортизации ОС, % */
  amortizationCoefficient?: number;
  /** Дата начала начисления амортизации */
  amortizationStartDate?: string | Date;
}

export interface ReferenceModel {
  id?: number;
  oldId: string;
  name: string;
  article?: string;
  typeReference: TypeReference;
  refValues: RefValues;
}
