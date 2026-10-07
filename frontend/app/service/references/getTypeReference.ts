import { MenuData } from '../../data/menu';
import { TypeReference } from '../../interfaces/reference.interface';

export const getTypeReference = (contentName: string): TypeReference => {
  // Сначала проверяем, является ли contentName уже валидным значением TypeReference
  // Это происходит когда в menuItems.tsx передается elem.title (например, TypeReference.PARTNERS)
  if (Object.values(TypeReference).includes(contentName as TypeReference)) {
    return contentName as TypeReference;
  }
  
  // Если нет, ищем по description (для обратной совместимости)
  const menuItem = MenuData.filter(item => item.title == 'Номлар')[0]?.subMenu?.find(el => el.description == contentName);
  const title = menuItem?.title;

  switch (title) {
    case TypeReference.PARTNERS:
      return TypeReference.PARTNERS;
    case TypeReference.CHARGES:
      return TypeReference.CHARGES
    case TypeReference.SERVICES:
      return TypeReference.SERVICES
    case TypeReference.PRICES:
      return TypeReference.PRICES;
    case TypeReference.STORAGES:
      return TypeReference.STORAGES;
    case TypeReference.TMZ:
      return TypeReference.TMZ;
    case TypeReference.WORKERS:
      return TypeReference.WORKERS;
    case TypeReference.WORKS:
      return TypeReference.WORKS;
    case TypeReference.COMMON_WORKS:
      return TypeReference.COMMON_WORKS;
    case TypeReference.CARS:
      return TypeReference.CARS;
    case TypeReference.MEDIATORS:
      return TypeReference.MEDIATORS;
    case TypeReference.DELIVERERS:
      return TypeReference.DELIVERERS;
    case TypeReference.APARTMENTS:
      return TypeReference.APARTMENTS;
    case TypeReference.TMZ_SHORT_NAME:
      return TypeReference.TMZ_SHORT_NAME;
    case TypeReference.TMZ_SIZE:
      return TypeReference.TMZ_SIZE;
    case TypeReference.TMZ_COLOR:
      return TypeReference.TMZ_COLOR;
    case TypeReference.TMZ_TEXTURE:
      return TypeReference.TMZ_TEXTURE;
    case TypeReference.TMZ_MANUFACTURE:
      return TypeReference.TMZ_MANUFACTURE;
    case TypeReference.TMZ_UNIT:
      return TypeReference.TMZ_UNIT;
    default:
      return TypeReference.PARTNERS
  }
}