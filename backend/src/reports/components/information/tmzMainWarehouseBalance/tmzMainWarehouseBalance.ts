import { Op } from "sequelize";
import { Schet } from "src/interfaces/report.interface";
import { TypeReference, TypeSECTION } from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { Stock } from "src/stocks/stock.model";

const TMZ_STOCK_SCHETS = [Schet.S10, Schet.S28, Schet.S21, Schet.S11, Schet.S29] as const;

export type TmzBalanceSchet = (typeof TMZ_STOCK_SCHETS)[number];

export interface TmzMainWarehouseBalanceEntry {
  qty: number;
  sum: number;
  schet: TmzBalanceSchet;
}

export interface TmzMainWarehouseBalanceValues {
  warehouseId: number | null;
  warehouseName: string;
  balanceDate: number;
  balances: Record<string, TmzMainWarehouseBalanceEntry>;
}

const resolveCommonWarehouse = (
  data: Reference[],
  enterpriseId?: number | null,
): Reference | null => {
  const candidates = data.filter((item) => {
    if (!item || item.typeReference !== TypeReference.STORAGES) return false;
    if (!item.refValues || item.refValues.markToDeleted) return false;
    if (item.refValues.typeSection !== TypeSECTION.COMMON) return false;

    if (enterpriseId !== undefined && enterpriseId !== null) {
      return item.enterpriseId === enterpriseId || item.enterpriseId === null;
    }
    return true;
  });

  if (enterpriseId !== undefined && enterpriseId !== null) {
    return (
      candidates.find((item) => item.enterpriseId === enterpriseId) ??
      candidates.find((item) => item.enterpriseId === null) ??
      null
    );
  }

  return candidates[0] ?? null;
};

export const tmzMainWarehouseBalance = async (
  data: Reference[],
  endDate: number | null,
  enterpriseId: number | null | undefined,
): Promise<{
  reportType: string;
  values: TmzMainWarehouseBalanceValues;
}> => {
  const balanceDate = endDate ?? Date.now();
  const commonWarehouse = resolveCommonWarehouse(data, enterpriseId);

  if (!commonWarehouse?.id) {
    return {
      reportType: "TMZMAINWAREHOUSEBALANCE",
      values: {
        warehouseId: null,
        warehouseName:
          enterpriseId != null
            ? `Умум булим топилмади (корхона ${enterpriseId})`
            : "Умум булим топилмади",
        balanceDate,
        balances: {},
      },
    };
  }

  const warehouseId = commonWarehouse.id;
  const warehouseName = commonWarehouse.name;

  const stockWhere: Record<string, unknown> = {
    schet: { [Op.in]: TMZ_STOCK_SCHETS },
    firstSubcontoId: warehouseId,
    secondSubcontoId: { [Op.ne]: null },
    date: { [Op.lte]: balanceDate },
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    stockWhere.enterpriseId = enterpriseId;
  }

  const stockRows = await Stock.findAll({
    where: stockWhere,
    attributes: [
      "schet",
      "secondSubcontoId",
      "remainCount",
      "remainTotal",
      "date",
      "id",
    ],
    order: [
      ["schet", "ASC"],
      ["secondSubcontoId", "ASC"],
      ["date", "DESC"],
      ["id", "DESC"],
    ],
  });

  const latestByKey = new Map<string, TmzMainWarehouseBalanceEntry>();

  for (const stock of stockRows) {
    const tmzId = Number(stock.secondSubcontoId);
    if (!tmzId) continue;

    const schet = stock.schet as TmzBalanceSchet;
    const key = `${schet}:${tmzId}`;
    if (latestByKey.has(key)) continue;

    latestByKey.set(key, {
      qty: Number(stock.remainCount) || 0,
      sum: Number(stock.remainTotal) || 0,
      schet,
    });
  }

  const balances: Record<string, TmzMainWarehouseBalanceEntry> = {};

  for (const [key, entry] of latestByKey.entries()) {
    const tmzId = key.split(":")[1];
    balances[tmzId] = { ...entry };
  }

  return {
    reportType: "TMZMAINWAREHOUSEBALANCE",
    values: {
      warehouseId,
      warehouseName,
      balanceDate,
      balances,
    },
  };
};
