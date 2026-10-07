export type ReplaceRowContext = {
  rowIndex: number;
  analiticId: number;
  productName?: string;
  productArticle?: string;
};

export type CatalogFocusProduct = {
  id: number;
  name?: string;
  article?: string;
};

export function toCatalogFocusProduct(ctx: ReplaceRowContext | null): CatalogFocusProduct | undefined {
  if (!ctx) return undefined;
  return {
    id: ctx.analiticId,
    name: ctx.productName,
    article: ctx.productArticle,
  };
}
