import { TypePartners, TypeSECTION, TypeTMZ, CarType, ProductionType, PriceClass, TypeReference, TypeMediator } from '@/app/interfaces/reference.interface'

/** Текстовые поля shortName/size/color/unit/manufacture в карточке ТМЗ (для сверки с данными справочника) */
export const TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS = false

/** Хамкорлар (CLIENTS/SUPPLIERS), ходимлар, харажатлар — общие справочники (enterpriseId = null) */
export const isSharedDirectoryReferenceType = (typeReference: TypeReference): boolean =>
  typeReference === TypeReference.PARTNERS ||
  typeReference === TypeReference.WORKERS ||
  typeReference === TypeReference.CHARGES ||
  typeReference === TypeReference.SERVICES

/** CLIENTS/SUPPLIERS PARTNERS, WORKERS, CHARGES — без фильтра по организации */
const isOrgFilterSkippedForReferenceType = (
  typeReference: TypeReference,
  partnerType?: string | TypePartners,
): boolean => {
  if (typeReference === TypeReference.WORKERS || typeReference === TypeReference.CHARGES || typeReference === TypeReference.SERVICES) {
    return true
  }
  if (typeReference === TypeReference.PARTNERS) {
    return (
      partnerType === TypePartners.CLIENTS ||
      partnerType === TypePartners.SUPPLIERS ||
      partnerType === 'CLIENTS' ||
      partnerType === 'SUPPLIERS'
    )
  }
  return false
}

/** В отчётах: не фильтровать общие справочники по выбранной организации (superKassir / global) */
export const shouldSkipOrgFilterInReportSelect = (
  typeReference: TypeReference,
  partnerType?: string,
): boolean => isOrgFilterSkippedForReferenceType(typeReference, partnerType)

/** В документах: показывать общие справочники с enterpriseId = null */
export const shouldAllowCommonReferenceInDocumentSelect = (
  typeReference: TypeReference,
  typePartners?: TypePartners,
): boolean => isOrgFilterSkippedForReferenceType(typeReference, typePartners)

export interface DataForSelect {
  name: string,
  title: string
}

export const typePartnersList: DataForSelect[] = [
  { name: '', title: 'Хамкор турини танланг' },
  { name: TypePartners.CLIENTS, title: 'Мижоз' },
  { name: TypePartners.DEPARTMENTS, title: 'Ички корхона' },
  { name: TypePartners.SUPPLIERS, title: 'Таъминотчи' }
]

export const typeTMZList: DataForSelect[] = [
  { name: '', title: 'ТМБ турини танланг' },
  { name: TypeTMZ.PRODUCT, title: 'Тайёр махсулот' },
  { name: TypeTMZ.MATERIAL, title: 'Материал' },
  { name: TypeTMZ.HALFSTUFF, title: 'Ярим тайёр махсулот' },
  { name: TypeTMZ.OS, title: 'Асосий восита' },
  { name: TypeTMZ.TOOLS, title: 'Ускуна (ижара)' },
  { name: TypeTMZ.TOVAR, title: 'Товар' },
]

export const typeSectionList: DataForSelect[] = [
  { name: '', title: 'Булим турини танланг' },
  { name: TypeSECTION.COMMON, title: 'Умум булим' },
  { name: TypeSECTION.PRODUCTION, title: 'Ишлаб чикариш цех' },
  { name: TypeSECTION.STORAGE, title: 'Склад' },
  { name: TypeSECTION.PARTNER_TOOLS, title: 'Субаренда (ҳамкор омбори)' },
  { name: TypeSECTION.CASH, title: 'Накд' },
  { name: TypeSECTION.BANK, title: 'Банк' },
  { name: TypeSECTION.PLASTIK, title: 'Пластик' },
  { name: TypeSECTION.FOUNDER, title: 'Таъсисчи' },
]

export const carTypeList: DataForSelect[] = [
  { name: '', title: 'Автомобил турини танланг' },
  { name: CarType.VIP, title: 'VIP' },
  { name: CarType.OWN, title: 'Узимизники' },
  { name: CarType.STRANGER, title: 'Бегона' }
]

export const mediatorTypeList: DataForSelect[] = [
  { name: '', title: 'Воситачи турини танланг' },
  { name: TypeMediator.DRIVER, title: 'Шофёр' },
  { name: TypeMediator.MASTER, title: 'Мастер' }
]

export const productionTypeList: DataForSelect[] = [
  { name: ProductionType.OTHER, title: 'Прочие' },
  { name: ProductionType.PB_PLITA, title: 'ПБ Плита' },
  { name: ProductionType.PK_PLITA, title: 'ПК Плита' },
  { name: ProductionType.BETON, title: 'Бетон' }
]

export const priceClassList: DataForSelect[] = [
  { name: '', title: 'Класс цен' },
  { name: PriceClass.A, title: 'Класс A' },
  { name: PriceClass.B, title: 'Класс B' },
  { name: PriceClass.C, title: 'Класс C' },
]