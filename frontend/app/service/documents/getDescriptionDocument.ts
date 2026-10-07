import { MenuData } from '../../data/menu';
import { DocumentType } from '../../interfaces/document.interface';

export const getDescriptionDocument = (name: string | DocumentType): string => {
  const documentsSection = MenuData.find(item => item.title === 'Хужжатлар');
  
  if (!documentsSection?.subGroups) {
    return '';
  }
  
  // Ищем в подгруппах документов
  // Normalize name to string for comparison (DocumentType enum values are strings)
  const nameValue = String(name);
  for (const subGroup of documentsSection.subGroups) {
    const foundItem = subGroup.items?.find(item => String(item.title) === nameValue);
    if (foundItem?.description) {
      return foundItem.description;
    }
  }
  
  return '';
}