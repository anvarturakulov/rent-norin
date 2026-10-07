import { ReferenceModel } from './reference.interface';

export interface ProductCalculation {
  id?: number;
  productId: number;
  materialId: number;
  quantityPerUnit: number;
  product?: ReferenceModel;
  material?: ReferenceModel;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateProductCalculationDto {
  productId: number;
  materialId: number;
  enterpriseId: number;
  quantityPerUnit: number;
}

export interface UpdateProductCalculationDto {
  productId?: number;
  materialId?: number;
  quantityPerUnit?: number;
}
