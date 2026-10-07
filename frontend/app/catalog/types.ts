export type PublicCatalogItemDto = {
  id: number;
  name: string;
  article: string | null;
  parentId: number | null;
  isFolder: boolean;
  unit?: string | null;
  websiteDescription?: string | null;
  displayPrice?: number | null;
  hourlyPrice?: number | null;
  dailyPrice?: number | null;
  images: string[];
};
