export enum TypeReference {
    CHARGES = 'CHARGES',
    SERVICES = 'SERVICES',
    PARTNERS = 'PARTNERS',
    PRICES = 'PRICES',
    STORAGES = 'STORAGES',
    TMZ = 'TMZ',
    WORKS = 'WORKS',
    COMMON_WORKS = 'COMMON_WORKS',
    WORKERS = 'WORKERS',
    CARS = 'CARS',
    APARTMENTS = 'APARTMENTS',
    WORK_ITEMS = 'WORK_ITEMS',
    TMZ_SHORT_NAME = 'TMZ_SHORT_NAME',
    TMZ_SIZE = 'TMZ_SIZE',
    TMZ_COLOR = 'TMZ_COLOR',
    TMZ_TEXTURE = 'TMZ_TEXTURE',
    TMZ_MANUFACTURE = 'TMZ_MANUFACTURE',
    TMZ_UNIT = 'TMZ_UNIT',
    MEDIATORS = 'MEDIATORS',
    DELIVERERS = 'DELIVERERS',
}

export const TMZ_ATTRIBUTE_DICTIONARY_TYPES: TypeReference[] = [
    TypeReference.TMZ_SHORT_NAME,
    TypeReference.TMZ_SIZE,
    TypeReference.TMZ_COLOR,
    TypeReference.TMZ_TEXTURE,
    TypeReference.TMZ_MANUFACTURE,
    TypeReference.TMZ_UNIT,
]

export function isTmzAttributeDictionaryType(typeReference: TypeReference): boolean {
    return TMZ_ATTRIBUTE_DICTIONARY_TYPES.includes(typeReference)
}

export enum TypePartners {
    CLIENTS = 'CLIENTS',
    DEPARTMENTS = 'DEPARTMENTS',
    SUPPLIERS = 'SUPPLIERS',
}

export enum TypeMediator {
    DRIVER = 'DRIVER',   // Шофёр
    MASTER = 'MASTER',   // Мастер
}

export enum TypeTMZ {
    PRODUCT = 'PRODUCT',
    HALFSTUFF = 'HALFSTUFF',
    MATERIAL = 'MATERIAL',
    OS = 'OS',
    TOOLS = 'TOOLS', // Инструменты (аренда)
    TOVAR = 'TOVAR', // Товары
}

/** Роль элемента в системе опалубки (TMZ TOOLS) */
export enum FormworkKind {
    PANEL = 'PANEL',
    CORNER_OUTER = 'CORNER_OUTER',
    CORNER_INNER = 'CORNER_INNER',
    LOCK = 'LOCK',
    BRACE = 'BRACE',
    TIE = 'TIE',
}

export const FORMWORK_KIND_LABELS: Record<FormworkKind, string> = {
    [FormworkKind.PANEL]: 'Қалқон (щит)',
    [FormworkKind.CORNER_OUTER]: 'Ташқи бурчак',
    [FormworkKind.CORNER_INNER]: 'Ички бурчак',
    [FormworkKind.LOCK]: 'Замок (қулф)',
    [FormworkKind.BRACE]: 'Подкос (тиргак)',
    [FormworkKind.TIE]: 'Стяжка (тортқич)',
}

/** Единица нормы расхода комплектующих опалубки */
export const FORMWORK_NORM_UNIT: Partial<Record<FormworkKind, string>> = {
    [FormworkKind.LOCK]: 'дона / 1 стык',
    [FormworkKind.BRACE]: 'дона / 1 м контура / ярус',
    [FormworkKind.TIE]: 'дона / 1 щит',
}

export const FORMWORK_NORM_DEFAULT: Partial<Record<FormworkKind, number>> = {
    [FormworkKind.LOCK]: 2,
    [FormworkKind.BRACE]: 0.7,
    [FormworkKind.TIE]: 2,
}

export enum TypeSECTION {
    COMMON = 'COMMON',
    CASH = 'CASH',
    BANK = 'BANK',
    PLASTIK = 'PLASTIK',
    FOUNDER = 'FOUNDER',
    PRODUCTION = 'PRODUCTION',
    STORAGE = 'STORAGE',
    PARTNER_TOOLS = 'PARTNER_TOOLS',
}

export enum CarType {
    VIP = 'VIP',
    OWN = 'OWN',
    STRANGER = 'STRANGER'
}

export enum ProductionType {
    PB_PLITA = 'PB_PLITA',   // ПБ Плита
    PK_PLITA = 'PK_PLITA',   // ПК Плита
    BETON = 'BETON',          // Бетон
    OTHER = 'OTHER'           // Прочие
}

export enum PriceClass {
    A = 'A',
    B = 'B',
    C = 'C',
}

/** Элемент списка файлов SCALING/DRAWING в ТМЗ: URL или объект после загрузки на сервер. */
export type TmzDrawingScalingFile =
    | string
    | {
          url: string;
          originalName?: string;
          visibleToClient?: boolean;
      };

export interface RefValues {
    clientForSectionId?: number
    partnerId?: number
    isDepartment?: boolean
    typePartners?: TypePartners 
    referredByMediatorId?: number
    isMediatorDriver?: boolean
    isMediatorMaster?: boolean
    isIndividualPerson?: boolean
    passportSeries?: string
    passportNumber?: string
    passportIssueDate?: string
    passportIssuedBy?: string
    isLegalEntity?: boolean
    bankName?: string
    bankAccount?: string
    bankMfo?: string
    typeTMZ?: TypeTMZ
    typeSection?: TypeSECTION
    unit?: string
    comment?: string
    markToDeleted?: boolean;
    importedFromXlsx?: boolean;
    norma?: number,
    un?: boolean
    longCharge?: boolean,
    telegramId?: string,
    /** Базовое значение в refValues; на дату — из периодики (`name`: `firstPrice`). */
    firstPrice?: number,
    /** Базовое значение в refValues; на дату — из периодики (`name`: `secondPrice`). */
    secondPrice?: number,
    /** Базовое значение в refValues; на дату — из периодики (`name`: `thirdPrice`). */
    thirdPrice?: number,
    countInBox?: number,
    imagePath?: string,
    imagePath2?: string,
    imagePath3?: string,
    showOnWebsite?: boolean,
    websiteDescription?: string,
    tmzWorks?: TmzWorkRow[],
    tmzMaterials?: TmzMaterialRow[],
    tmzTechMap?: TmzTechMapRow[],
    tmzComponents?: TmzComponentRow[],
    tmzPricing?: TmzPricing,
    filesFromScaling?: TmzDrawingScalingFile[],
    filesFromDrawing?: TmzDrawingScalingFile[],
    remainInStart?: number,
    costPriceInStart?: number,
    isForeign?: boolean,
    address?: string,
    phone?: string,
    phone2?: string,
    contactName1?: string,
    contactName2?: string,
    inn?: string,
    jshshir?: string,
    carModel?: string,
    carType?: CarType,
    svgPathId?: string,
    autoAcceptInterEnterprise?: boolean,
    isOffice?: boolean,
    productionType?: ProductionType,
    /** Класс цен готовой продукции */
    priceClass?: PriceClass,
    productMetr?: number,
    superKassir?: boolean,
    hasBuxgalter?: boolean,
    isMainWarehouse?: boolean,
    isDefectWarehouse?: boolean,
    isMagazine?: boolean,
    workDeptId?: number,
    /** Локация клиента (JSON latitude/longitude или текст) */
    location?: string,
    /** Краткое наименование ТМЗ */
    shortName?: string | null,
    shortNameId?: number,
    /** Размер */
    size?: string | null,
    sizeId?: number,
    /** Цвет */
    color?: string | null,
    colorId?: number,
    /** Текстура */
    texture?: string | null,
    textureId?: number,
    /** Производитель */
    manufacture?: string | null,
    manufactureId?: number,
    unitId?: number,
    /** Листовой материал (раскрой по размерам) */
    isSheetMaterial?: boolean,
    /** Инструмент субаренды (партнёрский) */
    isSubleaseTool?: boolean,
    /** Роль элемента опалубки */
    formworkKind?: FormworkKind | null,
    /** Норма расхода комплектующих опалубки */
    formworkNorm?: number | null,
    /** Высота листового материала, мм */
    height?: number,
    /** Ширина листового материала, мм */
    width?: number,
    /** Площадь листового материала, м² */
    area?: number,
    /** Производственные цеха, где может использоваться материал */
    allowedProductionDeptIds?: number[] | null,
    /** Годовой коэффициент амортизации ОС, % */
    amortizationCoefficient?: number,
    /** Дата начала начисления амортизации */
    amortizationStartDate?: string,
}

export interface TmzWorkRow {
    draftId?: string
    workName: string
    unit?: string
    countInUnit?: number
    timeInUnit?: number
    salaryInUnit?: number
}

export interface TmzMaterialRow {
    draftId?: string
    materialId?: number
    materialName?: string
    countPlanned?: number
    price?: number
}

export interface TmzTechMapRow {
    draftId?: string
    deptId?: number
    deptName?: string
    sequence?: number
}

export interface TmzComponentRow {
    draftId?: string
    componentId?: number
    componentName?: string
    qty?: number
}

/** Зарезервировано под параметры ценообразования ТМЗ (наценки — в pricing policy). */
export type TmzPricing = {
    /** BEFORE_COST, выключенные для колонки Умумий ишлар (пусто = все включены) */
    disabledBeforeCostMarkupCodes?: string[]
    /** BEFORE_COST, выключенные для колонки Ишлар (пусто = все включены) */
    disabledBeforeCostMarkupCodesWorks?: string[]
}

export interface ReferenceModel {
    id?: number
    name: string
    article?: string
    typeReference: TypeReference
    parentId?: number | null
    isFolder?: boolean
    enterpriseId?: number | null
    enterprise?: {
        id: number
        name: string
        code?: string
    } | null
    refValues : RefValues
}

export interface PereodicModel {
    id?: number
    referenceId: number
    enterpriseId?: number | null
    date: number
    name: string
    value: number
}
