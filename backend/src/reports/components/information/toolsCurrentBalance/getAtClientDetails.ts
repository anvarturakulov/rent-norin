import { Op } from "sequelize";
import { ClientToolOpenBatch } from "src/clientToolBatches/clientToolOpenBatch.model";
import { Schet } from "src/interfaces/report.interface";
import { ReferencesService } from "src/references/references.service";
import { Stock } from "src/stocks/stock.model";

export type ToolsAtClientBatchDetail = {
  openQty: number;
  initialQty: number;
  settlementDate: number | null;
  transferDocId: number | null;
};

export type ToolsAtClientClientDetail = {
  clientId: number;
  clientName: string;
  qty: number;
  batches: ToolsAtClientBatchDetail[];
};

export type ToolsAtClientDetailsResult = {
  toolId: number;
  toolName: string;
  asOf: number;
  totalAtClient: number;
  clients: ToolsAtClientClientDetail[];
};

const loadS12RemainsByClient = async (
  toolId: number,
  balanceDate: number,
  enterpriseId: number | null | undefined,
): Promise<Map<number, number>> => {
  const asOfExclusive = Number(balanceDate) + 1;

  const stockWhere: Record<string, unknown> = {
    schet: Schet.S12,
    secondSubcontoId: Number(toolId),
    firstSubcontoId: { [Op.ne]: null },
    date: { [Op.lt]: asOfExclusive },
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    stockWhere.enterpriseId = Number(enterpriseId);
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
      ["firstSubcontoId", "ASC"],
      ["date", "DESC"],
      ["id", "DESC"],
    ],
  });

  const latestByClient = new Map<number, number>();

  for (const stock of stockRows) {
    const clientId = Number(stock.firstSubcontoId);
    if (!clientId || latestByClient.has(clientId)) continue;
    const qty = Number(stock.remainCount) || 0;
    if (Math.abs(qty) <= 1e-9) continue;
    latestByClient.set(clientId, qty);
  }

  return latestByClient;
};

export async function getToolsAtClientDetails(
  toolId: number,
  asOf: number,
  enterpriseId: number | null | undefined,
  referencesService: ReferencesService,
): Promise<ToolsAtClientDetailsResult> {
  const normalizedToolId = Number(toolId);
  const balanceDate = Number(asOf) || Date.now();
  const asOfExclusive = balanceDate + 1;

  const normalizedEnterpriseId =
    enterpriseId !== undefined &&
    enterpriseId !== null &&
    Number(enterpriseId) > 0
      ? Number(enterpriseId)
      : null;

  let toolName = `Ускуна #${normalizedToolId}`;
  try {
    const toolRef = await referencesService.getReferenceById(normalizedToolId);
    if (toolRef?.name) toolName = toolRef.name;
  } catch {
    /* keep fallback */
  }

  const nameCache = new Map<number, string>();
  const resolveName = async (id: number): Promise<string> => {
    if (nameCache.has(id)) return nameCache.get(id)!;
    try {
      const ref = await referencesService.getReferenceById(id);
      const name = ref?.name || `ID ${id}`;
      nameCache.set(id, name);
      return name;
    } catch {
      const fallback = `ID ${id}`;
      nameCache.set(id, fallback);
      return fallback;
    }
  };

  const batchWhere: Record<string, unknown> = {
    toolId: normalizedToolId,
    openQty: { [Op.gt]: 0 },
    settlementDate: { [Op.lt]: asOfExclusive },
  };
  if (normalizedEnterpriseId != null) {
    batchWhere.enterpriseId = normalizedEnterpriseId;
  }

  const batches = await ClientToolOpenBatch.findAll({
    where: batchWhere,
    order: [
      ["clientId", "ASC"],
      ["settlementDate", "ASC"],
      ["id", "ASC"],
    ],
  });

  type AccClient = {
    clientId: number;
    clientName: string;
    qty: number;
    batches: ToolsAtClientBatchDetail[];
  };

  const byClient = new Map<number, AccClient>();

  for (const batch of batches) {
    const openQty = Number(batch.openQty) || 0;
    if (openQty <= 0) continue;

    const clientId = Number(batch.clientId);
    let group = byClient.get(clientId);
    if (!group) {
      group = {
        clientId,
        clientName: await resolveName(clientId),
        qty: 0,
        batches: [],
      };
      byClient.set(clientId, group);
    }

    group.qty += openQty;
    group.batches.push({
      openQty,
      initialQty: Number(batch.initialQty) || 0,
      settlementDate: Number(batch.settlementDate) || null,
      transferDocId: Number(batch.transferDocId) || null,
    });
  }

  // Fallback: S12 stock as-of when batches missing for some/all clients
  if (byClient.size === 0) {
    const stockByClient = await loadS12RemainsByClient(
      normalizedToolId,
      balanceDate,
      normalizedEnterpriseId,
    );

    for (const [clientId, qty] of stockByClient.entries()) {
      byClient.set(clientId, {
        clientId,
        clientName: await resolveName(clientId),
        qty,
        batches: [
          {
            openQty: qty,
            initialQty: qty,
            settlementDate: null,
            transferDocId: null,
          },
        ],
      });
    }
  }

  const clients = Array.from(byClient.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName, "uz", { sensitivity: "base" }),
  );

  const totalAtClient = clients.reduce((sum, c) => sum + c.qty, 0);

  return {
    toolId: normalizedToolId,
    toolName,
    asOf: balanceDate,
    totalAtClient,
    clients,
  };
}
