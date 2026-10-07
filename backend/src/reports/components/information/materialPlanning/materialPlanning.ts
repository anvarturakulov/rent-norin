import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderStageType } from "src/interfaces/furniture-order.interface";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { Reference } from "src/references/reference.model";
import { Stock } from "src/stocks/stock.model";

interface MaterialPlanningOrderRow {
  orderId: number;
  orderNumber: string;
  productId: number | null;
  productName: string;
  deadlineDate: number | null;
  clientName: string;
  requiredQty: number;
  consumedQty: number;
  remainingRequiredQty: number;
}

interface MaterialPlanningWarehouseRow {
  warehouseId: number;
  warehouseName: string;
  stockQty: number;
}

interface MaterialPlanningMaterialRow {
  materialId: number;
  materialName: string;
  article: string;
  uom: string;
  stockTotal: number;
  requiredTotal: number;
  consumedTotal: number;
  remainingRequiredTotal: number;
  balanceAfterCoverage: number;
  byWarehouses: MaterialPlanningWarehouseRow[];
  byOrders: MaterialPlanningOrderRow[];
}

interface MaterialPlanningTotals {
  stockTotal: number;
  requiredTotal: number;
  consumedTotal: number;
  remainingRequiredTotal: number;
  balanceAfterCoverage: number;
}

interface MaterialPlanningValues {
  generatedAt: number;
  materials: MaterialPlanningMaterialRow[];
  totals: MaterialPlanningTotals;
}

type OrderMeta = {
  orderNumber: string;
  productId: number | null;
  productName: string;
  deadlineDate: number | null;
  clientName: string;
};

export const materialPlanning = async (
  data: Reference[],
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: MaterialPlanningValues }> => {
  const now = Date.now();

  const orderWhere: any = {
    currentStage: OrderStageType.IN_PRODUCTION,
  };
  if (enterpriseId !== undefined && enterpriseId !== null) {
    orderWhere.enterpriseId = enterpriseId;
  }

  const activeOrders = await FurnitureOrder.findAll({
    where: orderWhere,
    attributes: ["id", "orderNumber", "analiticId", "clientId", "deadlineDate"],
  });

  if (activeOrders.length === 0) {
    return {
      reportType: "MATERIALPLANNING",
      values: {
        generatedAt: now,
        materials: [],
        totals: {
          stockTotal: 0,
          requiredTotal: 0,
          consumedTotal: 0,
          remainingRequiredTotal: 0,
          balanceAfterCoverage: 0,
        },
      },
    };
  }

  const orderIds = activeOrders.map((order) => Number(order.id));
  const refsById = new Map<number, Reference>();
  for (const ref of data) {
    if (ref.id) refsById.set(ref.id, ref);
  }

  const orderMetaById = new Map<number, OrderMeta>();
  for (const order of activeOrders) {
    const productId = order.analiticId ? Number(order.analiticId) : null;
    const clientId = order.clientId ? Number(order.clientId) : null;
    const productName = productId
      ? (refsById.get(productId)?.name ?? `Продукция ${productId}`)
      : "";
    const clientName = clientId
      ? (refsById.get(clientId)?.name ?? `Клиент ${clientId}`)
      : "";
    orderMetaById.set(Number(order.id), {
      orderNumber: order.orderNumber ?? `Заказ ${order.id}`,
      productId,
      productName,
      deadlineDate: order.deadlineDate ? Number(order.deadlineDate) : null,
      clientName,
    });
  }

  const plannedRows = await OrderMaterial.findAll({
    where: { orderId: { [Op.in]: orderIds } },
    attributes: ["orderId", "materialId", "countPlanned"],
  });

  const plannedByOrderMaterial = new Map<string, number>();
  const materialIdsSet = new Set<number>();

  for (const row of plannedRows) {
    const orderId = Number(row.orderId);
    const materialId = Number(row.materialId);
    if (!materialId || !orderMetaById.has(orderId)) continue;
    const plannedQty = Number(row.countPlanned) || 0;
    const key = `${orderId}:${materialId}`;
    plannedByOrderMaterial.set(
      key,
      (plannedByOrderMaterial.get(key) || 0) + plannedQty,
    );
    materialIdsSet.add(materialId);
  }

  const leaveDocWhere: any = {
    documentType: DocumentType.LeaveOnlyOneMaterial,
    docStatus: DocSTATUS.PROVEDEN,
  };
  if (enterpriseId !== undefined && enterpriseId !== null) {
    leaveDocWhere.enterpriseId = enterpriseId;
  }

  const leaveDocs = await Document.findAll({
    where: leaveDocWhere,
    attributes: ["id"],
    include: [{ model: DocValues, as: "docValues", required: true }],
  });

  const consumedByOrderMaterial = new Map<string, number>();
  for (const doc of leaveDocs as any[]) {
    const values = doc.docValues as DocValues | undefined;
    if (!values) continue;
    const orderId = Number(values.orderId);
    const materialId = Number(values.productForChargeId);
    if (!orderId || !materialId || !orderMetaById.has(orderId)) continue;
    const qty = Number(values.count) || 0;
    if (qty <= 0) continue;
    const key = `${orderId}:${materialId}`;
    consumedByOrderMaterial.set(
      key,
      (consumedByOrderMaterial.get(key) || 0) + qty,
    );
    materialIdsSet.add(materialId);
  }

  const stockWhere: any = {
    schet: Schet.S10,
    date: { [Op.lte]: now },
    secondSubcontoId: { [Op.ne]: null },
  };
  if (enterpriseId !== undefined && enterpriseId !== null) {
    stockWhere.enterpriseId = enterpriseId;
  }

  const stockRows = await Stock.findAll({
    where: stockWhere,
    attributes: [
      "firstSubcontoId",
      "secondSubcontoId",
      "remainCount",
      "date",
      "id",
    ],
    order: [
      ["secondSubcontoId", "ASC"],
      ["firstSubcontoId", "ASC"],
      ["date", "DESC"],
      ["id", "DESC"],
    ],
  });

  const latestStockByWarehouseMaterial = new Map<string, number>();
  for (const stock of stockRows) {
    const materialId = Number(stock.secondSubcontoId);
    const warehouseId = Number(stock.firstSubcontoId);
    if (!materialId || !warehouseId) continue;
    materialIdsSet.add(materialId);
    const key = `${warehouseId}:${materialId}`;
    if (latestStockByWarehouseMaterial.has(key)) continue;
    latestStockByWarehouseMaterial.set(key, Number(stock.remainCount) || 0);
  }

  const stockByMaterialWarehouse = new Map<number, Map<number, number>>();
  for (const [key, qty] of latestStockByWarehouseMaterial.entries()) {
    const [warehouseRaw, materialRaw] = key.split(":");
    const warehouseId = Number(warehouseRaw);
    const materialId = Number(materialRaw);
    if (!stockByMaterialWarehouse.has(materialId)) {
      stockByMaterialWarehouse.set(materialId, new Map<number, number>());
    }
    stockByMaterialWarehouse.get(materialId)!.set(warehouseId, qty);
  }

  const orderMaterialKeys = new Set<string>([
    ...plannedByOrderMaterial.keys(),
    ...consumedByOrderMaterial.keys(),
  ]);

  const materialRowsMap = new Map<number, MaterialPlanningMaterialRow>();
  const totals: MaterialPlanningTotals = {
    stockTotal: 0,
    requiredTotal: 0,
    consumedTotal: 0,
    remainingRequiredTotal: 0,
    balanceAfterCoverage: 0,
  };

  for (const materialId of materialIdsSet) {
    if (materialRowsMap.has(materialId)) continue;
    const materialRef = refsById.get(materialId);
    const warehousesMap = stockByMaterialWarehouse.get(materialId) || new Map();
    const byWarehouses: MaterialPlanningWarehouseRow[] = Array.from(
      warehousesMap.entries(),
    )
      .map(([warehouseId, stockQty]) => ({
        warehouseId,
        warehouseName:
          refsById.get(warehouseId)?.name ?? `Склад ${warehouseId}`,
        stockQty,
      }))
      .sort((a, b) =>
        (a.warehouseName || "").localeCompare(b.warehouseName || "", "ru"),
      );

    const stockTotal = byWarehouses.reduce(
      (sum, warehouse) => sum + (Number(warehouse.stockQty) || 0),
      0,
    );

    materialRowsMap.set(materialId, {
      materialId,
      materialName: materialRef?.name ?? `Материал ${materialId}`,
      article: materialRef?.article ?? "",
      uom: materialRef?.refValues?.unit ?? "",
      stockTotal,
      requiredTotal: 0,
      consumedTotal: 0,
      remainingRequiredTotal: 0,
      balanceAfterCoverage: stockTotal,
      byWarehouses,
      byOrders: [],
    });
  }

  for (const key of orderMaterialKeys) {
    const [orderRaw, materialRaw] = key.split(":");
    const orderId = Number(orderRaw);
    const materialId = Number(materialRaw);
    if (!orderMetaById.has(orderId) || !materialId) continue;

    const requiredQty = plannedByOrderMaterial.get(key) || 0;
    const consumedQty = consumedByOrderMaterial.get(key) || 0;
    const remainingRequiredQty = Math.max(requiredQty - consumedQty, 0);

    if (!materialRowsMap.has(materialId)) {
      const materialRef = refsById.get(materialId);
      const warehousesMap =
        stockByMaterialWarehouse.get(materialId) || new Map();
      const byWarehouses: MaterialPlanningWarehouseRow[] = Array.from(
        warehousesMap.entries(),
      )
        .map(([warehouseId, stockQty]) => ({
          warehouseId,
          warehouseName:
            refsById.get(warehouseId)?.name ?? `Склад ${warehouseId}`,
          stockQty,
        }))
        .sort((a, b) =>
          (a.warehouseName || "").localeCompare(b.warehouseName || "", "ru"),
        );

      const stockTotal = byWarehouses.reduce(
        (sum, warehouse) => sum + (Number(warehouse.stockQty) || 0),
        0,
      );

      materialRowsMap.set(materialId, {
        materialId,
        materialName: materialRef?.name ?? `Материал ${materialId}`,
        article: materialRef?.article ?? "",
        uom: materialRef?.refValues?.unit ?? "",
        stockTotal,
        requiredTotal: 0,
        consumedTotal: 0,
        remainingRequiredTotal: 0,
        balanceAfterCoverage: stockTotal,
        byWarehouses,
        byOrders: [],
      });
    }

    const row = materialRowsMap.get(materialId)!;
    const orderMeta = orderMetaById.get(orderId)!;
    row.byOrders.push({
      orderId,
      orderNumber: orderMeta.orderNumber,
      productId: orderMeta.productId,
      productName: orderMeta.productName,
      deadlineDate: orderMeta.deadlineDate,
      clientName: orderMeta.clientName,
      requiredQty,
      consumedQty,
      remainingRequiredQty,
    });
    row.requiredTotal += requiredQty;
    row.consumedTotal += consumedQty;
    row.remainingRequiredTotal += remainingRequiredQty;
  }

  const materials = Array.from(materialRowsMap.values())
    .map((row) => {
      row.byOrders.sort((a, b) =>
        (a.orderNumber || "").localeCompare(b.orderNumber || "", "ru"),
      );
      row.balanceAfterCoverage = row.stockTotal - row.remainingRequiredTotal;
      return row;
    })
    .sort((a, b) =>
      (a.materialName || "").localeCompare(b.materialName || "", "ru"),
    );

  for (const row of materials) {
    totals.stockTotal += row.stockTotal;
    totals.requiredTotal += row.requiredTotal;
    totals.consumedTotal += row.consumedTotal;
    totals.remainingRequiredTotal += row.remainingRequiredTotal;
  }
  totals.balanceAfterCoverage =
    totals.stockTotal - totals.remainingRequiredTotal;

  return {
    reportType: "MATERIALPLANNING",
    values: {
      generatedAt: now,
      materials,
      totals,
    },
  };
};
