import { ReferenceModel } from '@/app/interfaces/reference.interface'

export function sortByName (a: ReferenceModel, b: ReferenceModel): number {
  let nameA = a.name != null ? a.name.toLocaleLowerCase(): ''
  let nameB = b.name != null ? b.name.toLocaleLowerCase(): ''
  if (nameA < nameB) return -1
  if (nameA > nameB) return 1
  return 0
}

export function sortByNameWithDeleted (a: ReferenceModel, b: ReferenceModel): number {
  // Проверяем markToDeleted - элементы с markToDeleted = true должны быть внизу списка
  const aIsDeleted = a.refValues?.markToDeleted === true;
  const bIsDeleted = b.refValues?.markToDeleted === true;
  
  // Если один из элементов удален, а другой нет
  if (aIsDeleted && !bIsDeleted) return 1;  // a идет после b
  if (!aIsDeleted && bIsDeleted) return -1; // a идет перед b
  
  // Если оба элемента имеют одинаковый статус удаления, сортируем по алфавиту
  let nameA = a.name != null ? a.name.toLocaleLowerCase(): ''
  let nameB = b.name != null ? b.name.toLocaleLowerCase(): ''
  if (nameA < nameB) return -1
  if (nameA > nameB) return 1
  return 0
}
