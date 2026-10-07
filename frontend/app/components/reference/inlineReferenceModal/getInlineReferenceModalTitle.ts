import { TypeReference } from '@/app/interfaces/reference.interface';

export function getInlineReferenceModalTitle(
  typeReference: TypeReference,
  isEdit = false,
): string {
  if (isEdit) {
    switch (typeReference) {
      case TypeReference.PARTNERS:
        return 'Хамкорни таҳрирлаш';
      case TypeReference.WORKERS:
        return 'Ходимни таҳрирлаш';
      case TypeReference.DELIVERERS:
        return 'Доставщикни таҳрирлаш';
      case TypeReference.CHARGES:
        return 'Харажатни таҳрирлаш';
      case TypeReference.SERVICES:
        return 'Хизматни таҳрирлаш';
      case TypeReference.MEDIATORS:
        return 'Воситачини таҳрирлаш';
      case TypeReference.TMZ_SHORT_NAME:
        return 'Қисқа номни таҳрирлаш';
      case TypeReference.TMZ_SIZE:
        return 'Ўлчамни таҳрирлаш';
      case TypeReference.TMZ_COLOR:
        return 'Рангни таҳрирлаш';
      case TypeReference.TMZ_TEXTURE:
        return 'Текстурани таҳрирлаш';
      case TypeReference.TMZ_MANUFACTURE:
        return 'Ишлаб чиқарувчини таҳрирлаш';
      case TypeReference.TMZ_UNIT:
        return 'Ўлчов бирлигини таҳрирлаш';
      default:
        return 'Таҳрирлаш';
    }
  }

  switch (typeReference) {
    case TypeReference.PARTNERS:
      return 'Янги хамкор';
    case TypeReference.WORKERS:
      return 'Янги ходим';
    case TypeReference.DELIVERERS:
      return 'Янги доставщик';
    case TypeReference.CHARGES:
      return 'Янги харажат';
    case TypeReference.SERVICES:
      return 'Янги хизмат';
    case TypeReference.TMZ_SHORT_NAME:
      return 'Янги қисқа ном';
    case TypeReference.TMZ_SIZE:
      return 'Янги ўлчам';
    case TypeReference.TMZ_COLOR:
      return 'Янги ранг';
    case TypeReference.TMZ_TEXTURE:
      return 'Янги текстура';
    case TypeReference.TMZ_MANUFACTURE:
      return 'Янги ишлаб чиқарувчи';
    case TypeReference.TMZ_UNIT:
      return 'Янги ўлчов бирлиги';
    default:
      return 'Янги ном';
  }
}
