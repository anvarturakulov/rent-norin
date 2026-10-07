import { DocTableItem } from '@/app/interfaces/document.interface';

/**
 * Возвращает строку-подпись табличной части для сравнения при сохранении ComeProduct.
 * Используется чтобы предупредить, если пользователь изменил таблицы, но не нажал «Рассчитать».
 */
export function getComeProductCalculationSignature(
  docTableItems: DocTableItem[] | undefined
): string {
  if (!docTableItems || docTableItems.length === 0) {
    return '';
  }
  return JSON.stringify(docTableItems);
}
