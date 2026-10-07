import { TypeReference, TypeTMZ } from '@/app/interfaces/reference.interface';
import { DocumentType } from '@/app/interfaces/document.interface';

export const SELECT_TYPES = {
  SENDER: 'sender',
  RECEIVER: 'receiver',
  ANALITIC: 'analitic',
  PRODUCT_FOR_CHARGE: 'productForCharge',
  CAR: 'car',
  SENDER_PERSON: 'senderPerson',
  MATERIAL_RESPONSIBLE_PERSON: 'materialResponsiblePerson',
  MEDIATOR: 'mediator',
} as const;

export const TYPE_TMZ_MAPPING = {
  MATERIAL: TypeTMZ.MATERIAL,
  PRODUCT: TypeTMZ.PRODUCT,
  HALFSTUFF: TypeTMZ.HALFSTUFF,
  OS: TypeTMZ.OS,
  TOOLS: TypeTMZ.TOOLS,
  TOVAR: TypeTMZ.TOVAR,
} as const;

export const DOCUMENT_TYPE_REFERENCE_MAPPING = {
  MATERIAL: 'MATERIAL',
  PRODUCT: 'PRODUCT',
  HALFSTUFF: 'HALFSTUFF',
  OS: 'OS',
  TOOLS: 'TOOLS',
  TOVAR: 'TOVAR',
  OTHER: 'OTHER'
} as const;

export const DEFAULT_OPTION = {
  value: 'Танланмаган',
  label: '=>',
  dataType: null,
  dataId: null
} as const;

export const FILTER_CONDITIONS = {
  NOT_DELETED: (item: any) => !item.refValues?.markToDeleted,
  BY_TYPE_TMZ: (item: any, typeTMZ: TypeTMZ) => item.refValues?.typeTMZ === typeTMZ
} as const; 