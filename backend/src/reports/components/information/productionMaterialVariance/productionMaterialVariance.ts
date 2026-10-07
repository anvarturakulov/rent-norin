import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocValues } from "src/docValues/docValues.model";
import { ProductCalculationsService } from "src/productCalculations/productCalculations.service";

export interface ProductionSummaryItem {
  productId: number;
  productName: string;
  unit: string;
  totalCount: number;
  totalCost: number;
}

export interface ProductionTotals {
  totalCount: number;
  totalCost: number;
}

export interface ByMaterialItem {
  materialId: number;
  materialName: string;
  unit: string;
  factQuantity: number;
  normQuantity: number;
  diffQuantity: number;
  factTotal: number;
  normTotal: number;
  diffTotal: number;
}

export interface ProductionMaterialVarianceTotals {
  factQuantity: number;
  normQuantity: number;
  diffQuantity: number;
  factTotal: number;
  normTotal: number;
  diffTotal: number;
}

export interface ProductionMaterialVarianceValues {
  productionSummary: ProductionSummaryItem[];
  productionTotals: ProductionTotals;
  byMaterial: ByMaterialItem[];
  totals: ProductionMaterialVarianceTotals;
}

/**
 * Отчёт «Факт vs норма» по материалам производства.
 * Поступления готовой продукции из ComeProduct, списанные материалы (факт),
 * норма по произведённой продукции (product_calculations), разница факт/норма по количеству и сумме.
 */
export const productionMaterialVariance = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  productCalculationsService: ProductCalculationsService,
  enterpriseId?: number | null,
): Promise<{
  reportType: string;
  values: ProductionMaterialVarianceValues;
}> => {
  const productionSummary: ProductionSummaryItem[] = [];
  const productionTotals: ProductionTotals = { totalCount: 0, totalCost: 0 };
  const byMaterial: ByMaterialItem[] = [];
  const totals: ProductionMaterialVarianceTotals = {
    factQuantity: 0,
    normQuantity: 0,
    diffQuantity: 0,
    factTotal: 0,
    normTotal: 0,
    diffTotal: 0,
  };

  const producedCountByProduct = new Map<number, number>();
  const producedCostByProduct = new Map<number, number>();
  const factByMaterial = new Map<number, { quantity: number; total: number }>();
  const normQuantityByMaterial = new Map<number, number>();

  if (!startDate || !endDate) {
    return {
      reportType: "PRODUCTIONMATERIALVARIANCE",
      values: { productionSummary, productionTotals, byMaterial, totals },
    };
  }

  const where: any = {
    documentType: DocumentType.ComeProduct,
    docStatus: DocSTATUS.PROVEDEN,
  };
  if (enterpriseId !== undefined && enterpriseId !== null) {
    where.enterpriseId = enterpriseId;
  }

  const comeProductDocs = await Document.findAll({
    where,
    include: [
      { model: DocValues, as: "docValues" },
      { model: DocTableItems, as: "docTableItems" },
    ],
    order: [
      ["date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const filteredDocs = comeProductDocs.filter((doc: any) => {
    const docDate = Number(doc.date);
    return docDate >= startDate && docDate <= endDate;
  });

  for (const doc of filteredDocs) {
    if (!doc.docTableItems || doc.docTableItems.length === 0) continue;

    for (const row of doc.docTableItems) {
      const isIncome = !row.tableType || row.tableType === "income";
      const analiticId = row.analiticId;
      const count = Number(row.count) || 0;
      const total = Number(row.total) || 0;
      const costTotal = Number(row.costTotal) || 0;

      if (isIncome) {
        if (analiticId && count > 0) {
          const prevCount = producedCountByProduct.get(analiticId) || 0;
          producedCountByProduct.set(analiticId, prevCount + count);
          const prevCost = producedCostByProduct.get(analiticId) || 0;
          producedCostByProduct.set(analiticId, prevCost + costTotal);
        }
      } else {
        if (row.tableType === "expense" && analiticId) {
          const prev = factByMaterial.get(analiticId) || {
            quantity: 0,
            total: 0,
          };
          factByMaterial.set(analiticId, {
            quantity: prev.quantity + count,
            total: prev.total + total,
          });
        }
      }
    }
  }

  for (const [productId, producedCount] of producedCountByProduct.entries()) {
    try {
      const calculations = await productCalculationsService.findByProductId(
        productId,
        enterpriseId ?? undefined,
        false,
      );
      if (calculations && calculations.length > 0) {
        for (const calc of calculations) {
          const materialId = calc.materialId;
          const qtyPerUnit = Number(calc.quantityPerUnit) || 0;
          const normQty = producedCount * qtyPerUnit;
          const prev = normQuantityByMaterial.get(materialId) || 0;
          normQuantityByMaterial.set(materialId, prev + normQty);
        }
      }
    } catch {
      // skip product without norms
    }
  }

  const productRefs = data.filter(
    (r: Reference) =>
      r?.typeReference === TypeReference.TMZ &&
      r?.refValues?.typeTMZ === TypeTMZ.PRODUCT &&
      !r.refValues?.markToDeleted,
  );
  const productsById = new Map<number, Reference>();
  for (const p of productRefs) {
    if (p.id) productsById.set(p.id, p);
  }

  for (const [productId, totalCount] of producedCountByProduct.entries()) {
    const product = productsById.get(productId);
    const totalCost = producedCostByProduct.get(productId) ?? 0;
    productionSummary.push({
      productId,
      productName: product?.name ?? `Продукт ${productId}`,
      unit: product?.refValues?.unit ?? "",
      totalCount,
      totalCost,
    });
    productionTotals.totalCount += totalCount;
    productionTotals.totalCost += totalCost;
  }

  const allMaterialIds = new Set<number>([
    ...factByMaterial.keys(),
    ...normQuantityByMaterial.keys(),
  ]);
  const tmzRefs = data.filter(
    (r: Reference) =>
      r?.typeReference === TypeReference.TMZ && !r.refValues?.markToDeleted,
  );
  const refById = new Map<number, Reference>();
  for (const r of tmzRefs) {
    if (r.id) refById.set(r.id, r);
  }

  for (const materialId of allMaterialIds) {
    const fact = factByMaterial.get(materialId) ?? { quantity: 0, total: 0 };
    const normQty = normQuantityByMaterial.get(materialId) ?? 0;
    const avgPrice = fact.quantity > 0 ? fact.total / fact.quantity : 0;
    const normTotal = normQty * avgPrice;
    const diffQty = normQty - fact.quantity;
    const diffTotal = normTotal - fact.total;

    const ref = refById.get(materialId);
    byMaterial.push({
      materialId,
      materialName: ref?.name ?? `Материал ${materialId}`,
      unit: ref?.refValues?.unit ?? "",
      factQuantity: fact.quantity,
      normQuantity: normQty,
      diffQuantity: diffQty,
      factTotal: fact.total,
      normTotal,
      diffTotal,
    });

    totals.factQuantity += fact.quantity;
    totals.normQuantity += normQty;
    totals.diffQuantity += diffQty;
    totals.factTotal += fact.total;
    totals.normTotal += normTotal;
    totals.diffTotal += diffTotal;
  }

  productionSummary.sort((a, b) =>
    (a.productName || "").localeCompare(b.productName || "", "ru"),
  );
  byMaterial.sort((a, b) =>
    (a.materialName || "").localeCompare(b.materialName || "", "ru"),
  );

  return {
    reportType: "PRODUCTIONMATERIALVARIANCE",
    values: {
      productionSummary,
      productionTotals,
      byMaterial,
      totals,
    },
  };
};
