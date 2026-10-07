import { ProductCalculation } from '@/app/interfaces/productCalculation.interface';

// Используем NEXT_PUBLIC_DOMAIN для единообразия с остальным кодом

const arrayToMassiv = () => {
  return null
}

export class ProductCalculationsService {
  private static getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Получить все калькуляции
   */
  static async getAllCalculations(token: string): Promise<ProductCalculation[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching all calculations:', error);
      throw error;
    }
  }

  /**
   * Получить калькуляции по продукту
   */
  static async getCalculationsByProduct(productId: number, token: string): Promise<ProductCalculation[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations/product/${productId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching calculations by product:', error);
      throw error;
    }
  }

  /**
   * Получить калькуляцию по ID
   */
  static async getCalculationById(id: number, token: string): Promise<ProductCalculation> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching calculation by id:', error);
      throw error;
    }
  }

  /**
   * Создать новую калькуляцию
   */
  static async createCalculation(data: {
    productId: number;
    materialId: number;
    enterpriseId: number;
    quantityPerUnit: number;
  }, token: string): Promise<ProductCalculation> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations`, {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating calculation:', error);
      throw error;
    }
  }

  /**
   * Обновить калькуляцию
   */
  static async updateCalculation(id: number, data: {
    productId: number;
    materialId: number;
    quantityPerUnit: number;
  }, token: string): Promise<ProductCalculation> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations/${id}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating calculation:', error);
      throw error;
    }
  }

  /**
   * Удалить калькуляцию
   */
  static async deleteCalculation(id: number, token: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting calculation:', error);
      throw error;
    }
  }

  /**
   * Рассчитать материалы для продукта
   */
  static async calculateMaterials(data: {
    productId: number;
    quantity: number;
  }, token: string): Promise<any> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/product-calculations/calculate-materials`, {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating materials:', error);
      throw error;
    }
  }
}


