export interface TmzReferenceLabel {
  article?: string;
  name?: string;
}

/** Подпись ТМЗ для пользовательских сообщений: артикул → название → #id. */
export function formatTmzUserLabel(
  ref: TmzReferenceLabel | null | undefined,
  id: number,
): string {
  const article = ref?.article?.trim();
  if (article) return article;
  const name = ref?.name?.trim();
  if (name) return name;
  return `#${id}`;
}
