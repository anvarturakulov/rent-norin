import { TypeReference, TypeTMZ } from 'src/interfaces/reference.interface';
import { Reference } from 'src/references/reference.model';
import { ProductCalculationsService } from 'src/productCalculations/productCalculations.service';
import { Pereodic } from 'src/pereodic/pereodic.model';
import { Op } from 'sequelize';

/**
 * Отчет по нормам расхода материалов для ТМЦ (готовой продукции)
 * Для каждого ТМЦ показывает его нормы расхода по материалам
 */
export const tmcMaterialNorms = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    productCalculationsService: ProductCalculationsService,
    enterpriseId?: number | null
) => {
    let result: any[] = [];
    
    // Фильтруем все продукты (ТМЦ типа PRODUCT)
    const products = data.filter((item: Reference) => 
        item?.typeReference === TypeReference.TMZ && 
        item?.refValues?.typeTMZ === TypeTMZ.PRODUCT &&
        !item.refValues?.markToDeleted
    );
    
    
    // Используем endDate из интервала отчета для получения thirdPrice на конец периода
    // Если endDate не указан, используем текущую дату
    const reportEndDate = endDate || Date.now();
    
    // Загружаем периодические значения thirdPrice для всех продуктов
    const productIds = products.map(p => p.id).filter((id): id is number => id !== undefined);
    const thirdPriceMap = new Map<number, Map<number, number>>(); // Map<productId, Map<date, thirdPrice>>
    
    if (productIds.length > 0) {
        try {
            const where: any = {
                referenceId: { [Op.in]: productIds },
                name: 'thirdPrice',
                date: { [Op.lte]: reportEndDate }
            };
            
            if (enterpriseId !== undefined && enterpriseId !== null) {
                where[Op.or] = [
                    { enterpriseId: enterpriseId },
                    { enterpriseId: null }
                ];
            } else {
                where.enterpriseId = null;
            }
            
            const allPereodics = await Pereodic.findAll({
                where,
                order: [['referenceId', 'ASC'], ['date', 'ASC']]
            });
            
            for (const pereodic of allPereodics) {
                const refId = pereodic.referenceId;
                const date = Number(pereodic.date);
                const value = pereodic.value || 0;
                
                if (!thirdPriceMap.has(refId)) {
                    thirdPriceMap.set(refId, new Map());
                }
                thirdPriceMap.get(refId)!.set(date, value);
            }
            
        } catch (error) {
        }
    }
    
    // Функция для получения thirdPrice для продукта на указанную дату (конец периода отчета)
    const getThirdPriceForDate = (product: Reference, date: number): number => {
        // Сначала проверяем refValues
        if (product?.refValues?.thirdPrice) {
            return product.refValues.thirdPrice;
        }
        
        // Затем ищем в периодических значениях
        const pereodicMap = thirdPriceMap.get(product.id!);
        if (pereodicMap && pereodicMap.size > 0) {
            // Находим последнее значение до указанной даты
            let lastValue = 0;
            let lastDate = 0;
            for (const [pereodicDate, value] of pereodicMap.entries()) {
                if (pereodicDate <= date && pereodicDate > lastDate) {
                    lastDate = pereodicDate;
                    lastValue = value;
                }
            }
            return lastValue;
        }
        
        return 0;
    };
    
    // Для каждого продукта получаем его нормы расхода по материалам
    for (const product of products) {
        if (!product.id) continue;
        
        try {
            // Получаем все калькуляции для этого продукта
            const calculations = await productCalculationsService.findByProductId(
                product.id, 
                enterpriseId || undefined,
                false // isSuperUser
            );
            
            // Если есть нормы расхода, добавляем в результат
            if (calculations && calculations.length > 0) {
                const materialNorms = calculations.map(calc => ({
                    materialId: calc.materialId,
                    materialName: calc.material?.name || `Материал ${calc.materialId}`,
                    quantityPerUnit: calc.quantityPerUnit,
                    unit: calc.material?.refValues?.unit || ''
                }));
                
                // Получаем thirdPrice на дату конца отчета
                const thirdPrice = getThirdPriceForDate(product, reportEndDate);
                
                result.push({
                    productId: product.id,
                    productName: product.name,
                    unit: product.refValues?.unit || '',
                    thirdPrice: thirdPrice,
                    materialNorms: materialNorms
                });
            }
        } catch (error) {
        }
    }
    
    
    return {
        reportType: 'TMCMATERIALNORMS',
        values: result
    };
};

