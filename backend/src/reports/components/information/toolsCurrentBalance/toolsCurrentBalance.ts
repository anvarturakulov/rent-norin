import { Op } from "sequelize";
import { Schet } from "src/interfaces/report.interface";
import {
  TypeReference,
  TypeSECTION,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { ReferencesService } from "src/references/references.service";
import { Stock } from "src/stocks/stock.model";

export interface ToolsCurrentBalanceRow {
  toolId: number;
  toolName: string;
  article: string;
  warehouseQty: number;
  atClientQty: number;
  totalQty: number;
  warehouseSum: number;
}

export interface ToolsCurrentBalanceValues {
  balanceDate: number;
  warehouseId: number | null;
  warehouseName: string | null;
  rows: ToolsCurrentBalanceRow[];
  totals: {
    warehouseQty: number;
    atClientQty: number;
    totalQty: number;
    warehouseSum: number;
  };
}

type RemainAgg = { qty: number; sum: number };

const resolveCommonWarehouseFromData = (
  data: Reference[],
  enterpriseId?: number | null,
): Reference | null => {
  const targetEnterpriseId =
    enterpriseId !== undefined && enterpriseId !== null
      ? Number(enterpriseId)
      : null;

  const candidates = data.filter((item) => {
    if (!item || item.typeReference !== TypeReference.STORAGES) return false;
    if (!item.refValues || item.refValues.markToDeleted) return false;
    if (item.refValues.typeSection !== TypeSECTION.COMMON) return false;

    if (targetEnterpriseId != null) {
      const itemEnterpriseId =
        item.enterpriseId === null || item.enterpriseId === undefined
          ? null
          : Number(item.enterpriseId);
      return (
        itemEnterpriseId === targetEnterpriseId || itemEnterpriseId === null
      );
    }
    return true;
  });

  if (targetEnterpriseId != null) {
    return (
      candidates.find(
        (item) => Number(item.enterpriseId) === targetEnterpriseId,
      ) ??
      candidates.find(
        (item) => item.enterpriseId === null || item.enterpriseId === undefined,
      ) ??
      null
    );
  }

  return candidates[0] ?? null;
};

const loadRemainsByTool = async (
  schet: Schet,
  balanceDate: number,
  enterpriseId: number | null | undefined,
  firstSubcontoId?: number | null,
): Promise<Map<number, RemainAgg>> => {
  // Как getStockByDate / transfer preview: остаток «на момент» = записи с date < balanceDate+1
  const asOfExclusive = Number(balanceDate) + 1;

  const stockWhere: Record<string, unknown> = {
    schet,
    secondSubcontoId: { [Op.ne]: null },
    date: { [Op.lt]: asOfExclusive },
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    stockWhere.enterpriseId = Number(enterpriseId);
  }

  if (firstSubcontoId !== undefined && firstSubcontoId !== null) {
    stockWhere.firstSubcontoId = Number(firstSubcontoId);
  }

  const stockRows = await Stock.findAll({
    where: stockWhere,
    attributes: [
      "firstSubcontoId",
      "secondSubcontoId",
      "remainCount",
      "remainTotal",
      "date",
      "id",
    ],
    order: [
      ["firstSubcontoId", "ASC"],
      ["secondSubcontoId", "ASC"],
      ["date", "DESC"],
      ["id", "DESC"],
    ],
  });

  const latestByLocationAndTool = new Map<string, RemainAgg>();

  for (const stock of stockRows) {
    const locationId = Number(stock.firstSubcontoId);
    const toolId = Number(stock.secondSubcontoId);
    if (!toolId) continue;

    const key = `${locationId}:${toolId}`;
    if (latestByLocationAndTool.has(key)) continue;

    latestByLocationAndTool.set(key, {
      qty: Number(stock.remainCount) || 0,
      sum: Number(stock.remainTotal) || 0,
    });
  }

  const byTool = new Map<number, RemainAgg>();

  for (const [key, entry] of latestByLocationAndTool.entries()) {
    const toolId = Number(key.split(":")[1]);
    const prev = byTool.get(toolId) ?? { qty: 0, sum: 0 };
    byTool.set(toolId, {
      qty: prev.qty + entry.qty,
      sum: prev.sum + entry.sum,
    });
  }

  return byTool;
};

export const toolsCurrentBalance = async (
  data: Reference[],
  endDate: number | null,
  enterpriseId: number | null | undefined,
  _warehouseId?: number | null,
  referencesService?: ReferencesService,
): Promise<{
  reportType: string;
  values: ToolsCurrentBalanceValues;
}> => {
  const balanceDate = endDate ?? Date.now();
  const normalizedEnterpriseId =
    enterpriseId !== undefined &&
    enterpriseId !== null &&
    Number(enterpriseId) > 0
      ? Number(enterpriseId)
      : null;

  let commonWarehouse: Reference | null = null;

  if (normalizedEnterpriseId != null && referencesService) {
    try {
      commonWarehouse =
        (await referencesService.findCommonStorageByEnterpriseId(
          normalizedEnterpriseId,
        )) ?? null;
    } catch {
      commonWarehouse = null;
    }
  }

  if (!commonWarehouse) {
    commonWarehouse = resolveCommonWarehouseFromData(
      data,
      normalizedEnterpriseId,
    );
  }

  const resolvedWarehouseId = commonWarehouse?.id
    ? Number(commonWarehouse.id)
    : null;
  const warehouseName =
    commonWarehouse?.name ??
    (normalizedEnterpriseId != null
      ? `Умум булим топилмади (корхона ${normalizedEnterpriseId})`
      : "Умум булим топилмади — корхонани танланг");

  const tools = data.filter((item) => {
    if (
      item?.id == null ||
      item.typeReference !== TypeReference.TMZ ||
      item.isFolder ||
      item.refValues?.markToDeleted ||
      item.refValues?.typeTMZ !== TypeTMZ.TOOLS
    ) {
      return false;
    }
    if (normalizedEnterpriseId == null) return true;
    const itemEnterpriseId =
      item.enterpriseId === null || item.enterpriseId === undefined
        ? null
        : Number(item.enterpriseId);
    return (
      itemEnterpriseId === normalizedEnterpriseId || itemEnterpriseId === null
    );
  });

  const [warehouseByTool, atClientByTool] = await Promise.all([
    // S11: фильтр только по COMMON склада (он уже привязан к корхоне)
    resolvedWarehouseId != null
      ? loadRemainsByTool(Schet.S11, balanceDate, null, resolvedWarehouseId)
      : Promise.resolve(new Map<number, RemainAgg>()),
    loadRemainsByTool(Schet.S12, balanceDate, normalizedEnterpriseId, null),
  ]);

  const toolIds = new Set<number>();
  for (const tool of tools) {
    toolIds.add(tool.id);
  }
  for (const id of warehouseByTool.keys()) {
    toolIds.add(id);
  }
  for (const id of atClientByTool.keys()) {
    toolIds.add(id);
  }

  const toolById = new Map(tools.map((t) => [t.id, t]));

  const rows: ToolsCurrentBalanceRow[] = [];

  for (const toolId of toolIds) {
    const warehouse = warehouseByTool.get(toolId) ?? { qty: 0, sum: 0 };
    const atClient = atClientByTool.get(toolId) ?? { qty: 0, sum: 0 };
    const totalQty = warehouse.qty + atClient.qty;

    const ref = toolById.get(toolId);
    const toolName = ref?.name ?? `Ускуна #${toolId}`;
    const article =
      (ref as { article?: string } | undefined)?.article?.trim() ||
      (ref?.refValues?.shortName as string | undefined)?.trim() ||
      "";

    rows.push({
      toolId,
      toolName,
      article,
      warehouseQty: warehouse.qty,
      atClientQty: atClient.qty,
      totalQty,
      warehouseSum: warehouse.sum,
    });
  }

  rows.sort((a, b) =>
    a.toolName.localeCompare(b.toolName, "uz", { sensitivity: "base" }),
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.warehouseQty += row.warehouseQty;
      acc.atClientQty += row.atClientQty;
      acc.totalQty += row.totalQty;
      acc.warehouseSum += row.warehouseSum;
      return acc;
    },
    {
      warehouseQty: 0,
      atClientQty: 0,
      totalQty: 0,
      warehouseSum: 0,
    },
  );

  return {
    reportType: "TOOLSCURRENTBALANCE",
    values: {
      balanceDate,
      warehouseId: resolvedWarehouseId,
      warehouseName,
      rows,
      totals,
    },
  };
};
