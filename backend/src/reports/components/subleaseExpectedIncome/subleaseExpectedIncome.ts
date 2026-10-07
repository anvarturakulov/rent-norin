import { SubleaseToolBatchesService } from "src/subleaseToolBatches/subleaseToolBatches.service";
import { ReferencesService } from "src/references/references.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same minimum as receive-tools / rental expected income (`MIN_RENT_HOURS`). */
const MIN_RENT_HOURS = 24;

export type SubleaseExpectedIncomeToolRow = {
  toolId: number;
  toolName: string;
  partnerId: number;
  partnerName: string;
  count: number;
  settlementDate: number;
  rentHours: number;
  hourlyTariff: number;
  partnerHourlyTariff: number;
  clientRentSum: number;
  partnerCostSum: number;
  margin: number;
  transferDocId: number;
};

export type SubleaseExpectedIncomeClientRow = {
  clientId: number;
  clientName: string;
  totalClientRent: number;
  totalPartnerCost: number;
  totalMargin: number;
  tools: SubleaseExpectedIncomeToolRow[];
};

export type SubleaseExpectedIncomeResult = {
  reportType: "SUBLEASE_EXPECTED_INCOME";
  asOf: number;
  grandTotalClientRent: number;
  grandTotalPartnerCost: number;
  grandTotalMargin: number;
  clients: SubleaseExpectedIncomeClientRow[];
};

export async function subleaseExpectedIncome(
  asOf: number,
  enterpriseId: number,
  clientId: number | null | undefined,
  subleaseToolBatchesService: SubleaseToolBatchesService,
  referencesService: ReferencesService,
): Promise<SubleaseExpectedIncomeResult> {
  const batches = await subleaseToolBatchesService.findOpenBatches(
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
    totalClientRent: number;
    totalPartnerCost: number;
    totalMargin: number;
    tools: SubleaseExpectedIncomeToolRow[];
  };

  const byClient = new Map<number, AccClient>();

  for (const batch of batches) {
    const openQty = Number(batch.openQty);
    if (openQty <= 0) continue;

    const settlementDate = Number(batch.settlementDate);
    if (!Number.isFinite(settlementDate) || settlementDate > asOf) continue;

    const hourlyTariff = Number(batch.hourlyTariff) || 0;
    const partnerHourlyTariff = Number(batch.partnerHourlyTariff) || 0;
    const rentHours = round2(
      Math.max(MIN_RENT_HOURS, (asOf - settlementDate) / 3_600_000),
    );
    const clientRentSum = round2(rentHours * hourlyTariff * openQty);
    const partnerCostSum = round2(rentHours * partnerHourlyTariff * openQty);
    const margin = round2(clientRentSum - partnerCostSum);

    const cid = Number(batch.clientId);
    let group = byClient.get(cid);
    if (!group) {
      group = {
        clientId: cid,
        clientName: await resolveName(cid),
        totalClientRent: 0,
        totalPartnerCost: 0,
        totalMargin: 0,
        tools: [],
      };
      byClient.set(cid, group);
    }

    const toolId = Number(batch.toolId);
    const partnerId = Number(batch.partnerId) || 0;
    group.tools.push({
      toolId,
      toolName: await resolveName(toolId),
      partnerId,
      partnerName: partnerId ? await resolveName(partnerId) : "—",
      count: openQty,
      settlementDate,
      rentHours,
      hourlyTariff,
      partnerHourlyTariff,
      clientRentSum,
      partnerCostSum,
      margin,
      transferDocId: Number(batch.transferDocId),
    });
    group.totalClientRent = round2(group.totalClientRent + clientRentSum);
    group.totalPartnerCost = round2(group.totalPartnerCost + partnerCostSum);
    group.totalMargin = round2(group.totalMargin + margin);
  }

  const clients = Array.from(byClient.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName, "ru"),
  );

  const grandTotalClientRent = round2(
    clients.reduce((sum, c) => sum + c.totalClientRent, 0),
  );
  const grandTotalPartnerCost = round2(
    clients.reduce((sum, c) => sum + c.totalPartnerCost, 0),
  );
  const grandTotalMargin = round2(
    clients.reduce((sum, c) => sum + c.totalMargin, 0),
  );

  return {
    reportType: "SUBLEASE_EXPECTED_INCOME",
    asOf,
    grandTotalClientRent,
    grandTotalPartnerCost,
    grandTotalMargin,
    clients,
  };
}
