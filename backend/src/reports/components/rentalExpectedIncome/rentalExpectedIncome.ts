import { ClientToolBatchesService } from "src/clientToolBatches/clientToolBatches.service";
import { ReferencesService } from "src/references/references.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same minimum as receive-tools return billing (`MIN_RENT_HOURS` / buildPreviewRows). */
const MIN_RENT_HOURS = 24;

export type RentalExpectedIncomeToolRow = {
  toolId: number;
  toolName: string;
  count: number;
  settlementDate: number;
  hourlyTariff: number;
  rentHours: number;
  rentSum: number;
  transferDocId: number;
};

export type RentalExpectedIncomeClientRow = {
  clientId: number;
  clientName: string;
  totalRentSum: number;
  tools: RentalExpectedIncomeToolRow[];
};

export type RentalExpectedIncomeResult = {
  reportType: "RENTAL_EXPECTED_INCOME";
  asOf: number;
  grandTotal: number;
  clients: RentalExpectedIncomeClientRow[];
};

export async function rentalExpectedIncome(
  asOf: number,
  enterpriseId: number,
  clientId: number | null | undefined,
  clientToolBatchesService: ClientToolBatchesService,
  referencesService: ReferencesService,
): Promise<RentalExpectedIncomeResult> {
  const batches = await clientToolBatchesService.findOpenBatches(
    enterpriseId,
    clientId,
  );

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

  type AccClient = {
    clientId: number;
    clientName: string;
    totalRentSum: number;
    tools: RentalExpectedIncomeToolRow[];
  };

  const byClient = new Map<number, AccClient>();

  for (const batch of batches) {
    const openQty = Number(batch.openQty);
    if (openQty <= 0) continue;

    const settlementDate = Number(batch.settlementDate);
    // Only tools already issued by asOf («выданы до Сана ва вақт»)
    if (!Number.isFinite(settlementDate) || settlementDate > asOf) continue;

    const hourlyTariff = Number(batch.hourlyTariff) || 0;
    const rentHours = round2(
      Math.max(MIN_RENT_HOURS, (asOf - settlementDate) / 3_600_000),
    );
    const rentSum = round2(rentHours * hourlyTariff * openQty);

    const cid = Number(batch.clientId);
    let group = byClient.get(cid);
    if (!group) {
      group = {
        clientId: cid,
        clientName: await resolveName(cid),
        totalRentSum: 0,
        tools: [],
      };
      byClient.set(cid, group);
    }

    const toolId = Number(batch.toolId);
    group.tools.push({
      toolId,
      toolName: await resolveName(toolId),
      count: openQty,
      settlementDate,
      hourlyTariff,
      rentHours,
      rentSum,
      transferDocId: Number(batch.transferDocId),
    });
    group.totalRentSum = round2(group.totalRentSum + rentSum);
  }

  const clients = Array.from(byClient.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName, "ru"),
  );

  const grandTotal = round2(
    clients.reduce((sum, c) => sum + c.totalRentSum, 0),
  );

  return {
    reportType: "RENTAL_EXPECTED_INCOME",
    asOf,
    grandTotal,
    clients,
  };
}
