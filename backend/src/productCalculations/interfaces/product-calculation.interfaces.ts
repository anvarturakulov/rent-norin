// Интерфейсы для calculateMaterials
export interface ProductQuantityInput {
  productId: number;
  quantity: number;
}

export interface CalculateMaterialsInput {
  products: ProductQuantityInput[];
  enterpriseId?: number;
}

export interface MaterialCalculationResult {
  materialId: number;
  materialName: string;
  totalQuantity: number;
  productBreakdown: {
    productId: number;
    productName: string;
    quantity: number;
    requiredQuantity: number;
  }[];
}
