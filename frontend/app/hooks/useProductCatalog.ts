import { useState, useCallback } from 'react';
import { Product, convertProductToDocTableItem, isProductInDocument, updateProductQuantityInDocument } from '@/app/interfaces/product.interface';
import { DocTableItem } from '@/app/interfaces/document.interface';

interface UseProductCatalogProps {
  onProductSelected: (product: Product, quantity: number, customPrice?: number) => void;
  currentDocTableItems?: DocTableItem[];
}

export const useProductCatalog = ({ 
  onProductSelected, 
  currentDocTableItems = [] 
}: UseProductCatalogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const openCatalog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCatalog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelectProduct = useCallback((product: Product, quantity: number, customPrice?: number) => {
    // Всегда передаем товар, количество и цену в родительский компонент
    // Логика суммирования уже есть в ProductCatalogIntegration
    console.log('🔗 useProductCatalog.handleSelectProduct передает:', { productName: product.name, quantity, customPrice });
    onProductSelected(product, quantity, customPrice);
    closeCatalog();
  }, [onProductSelected, closeCatalog]);

  return {
    isOpen,
    openCatalog,
    closeCatalog,
    handleSelectProduct
  };
};
