import { TypePartners, TypeReference } from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";
import { query } from "src/reports/querys/query";
import { StocksService } from "src/stocks/stocks.service";
import {
  ContractFulfillmentRow,
  loadMappedContracts,
  toNum,
} from "../contractFulfillment/contractFulfillment.mapper";

const EPS = 0.0001;

export type ClientsContractsWorkClient = {
  clientId: number;
  clientName: string;
  startBalance: number;
  debitTurnover: number;
  creditTurnover: number;
  endBalance: number;
  contracts: ContractFulfillmentRow[];
  linesDone: number;
  linesTotal: number;
};

export type ClientsContractsWorkSummary = {
  clientsTotal: number;
  withContract: number;
  withoutContract: number;
  withStartDebt: number;
  startBalanceTotal: number;
  withEndDebt: number;
  endBalanceTotal: number;
  debitTurnoverTotal: number;
  creditTurnoverTotal: number;
  contractsTotal: number;
  linesDone: number;
  linesTotal: number;
};

export type ClientsContractsWorkValues = {
  summary: ClientsContractsWorkSummary;
  clients: ClientsContractsWorkClient[];
};

const emptySummary = (): ClientsContractsWorkSummary => ({
  clientsTotal: 0,
  withContract: 0,
  withoutContract: 0,
  withStartDebt: 0,
  startBalanceTotal: 0,
  withEndDebt: 0,
  endBalanceTotal: 0,
  debitTurnoverTotal: 0,
  creditTurnoverTotal: 0,
  contractsTotal: 0,
  linesDone: 0,
  linesTotal: 0,
});

const emptyValues = (): ClientsContractsWorkValues => ({
  summary: emptySummary(),
  clients: [],
});

function isNonZero(value: number): boolean {
  return Math.abs(value) > EPS;
}

function clientNameFromData(
  data: any,
  clientId: number,
  fallback?: string,
): string {
  if (fallback && fallback !== "—") return fallback;
  if (Array.isArray(data)) {
    const item = data.find((ref: any) => Number(ref?.id) === clientId);
    if (item?.name) return String(item.name);
  }
  return fallback || `#${clientId}`;
}

function isClientReference(item: any): boolean {
  return (
    item?.typeReference === TypeReference.PARTNERS &&
    item?.refValues?.typePartners === TypePartners.CLIENTS
  );
}

export const clientsContractsWork = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: ClientsContractsWorkValues }> => {
  if (!startDate || !endDate) {
    return { reportType: "ClientsContractsWork", values: emptyValues() };
  }

  const contractRows = await loadMappedContracts({ enterpriseId });
  const contractsByClient = new Map<number, ContractFulfillmentRow[]>();
  for (const row of contractRows) {
    if (!row.clientId) continue;
    const list = contractsByClient.get(row.clientId) ?? [];
    list.push(row);
    contractsByClient.set(row.clientId, list);
  }

  const candidateIds = new Set<number>();
  for (const clientId of contractsByClient.keys()) {
    candidateIds.add(clientId);
  }

  const subcontos = await oborotsService.getSubcontosBySchet(
    Schet.S40,
    startDate,
    endDate,
    enterpriseId,
  );
  for (const rawId of subcontos.firstList ?? []) {
    const id = toNum(rawId);
    if (!id) continue;
    if (Array.isArray(data) && data.length) {
      const ref = data.find((item: any) => Number(item?.id) === id);
      if (ref && !isClientReference(ref)) continue;
    }
    candidateIds.add(id);
  }

  const closingAsOf = endDate + 1;
  const ids = [...candidateIds];

  const balances = await Promise.all(
    ids.map(async (clientId) => {
      const [startBalance, endBalance, debitTurnover, creditTurnover] =
        await Promise.all([
          query(
            Schet.S40,
            TypeQuery.POSUM,
            startDate,
            endDate,
            clientId,
            null,
            null,
            stocksService,
            oborotsService,
            enterpriseId,
          ),
          query(
            Schet.S40,
            TypeQuery.KOSUM,
            startDate,
            closingAsOf,
            clientId,
            null,
            null,
            stocksService,
            oborotsService,
            enterpriseId,
          ),
          query(
            Schet.S40,
            TypeQuery.TDSUM,
            startDate,
            endDate,
            clientId,
            null,
            null,
            stocksService,
            oborotsService,
            enterpriseId,
          ),
          query(
            Schet.S40,
            TypeQuery.TKSUM,
            startDate,
            endDate,
            clientId,
            null,
            null,
            stocksService,
            oborotsService,
            enterpriseId,
          ),
        ]);
      return {
        clientId,
        startBalance: Number(startBalance) || 0,
        endBalance: Number(endBalance) || 0,
        debitTurnover: Number(debitTurnover) || 0,
        creditTurnover: Number(creditTurnover) || 0,
      };
    }),
  );

  const clients: ClientsContractsWorkClient[] = [];
  for (const row of balances) {
    const contracts = contractsByClient.get(row.clientId) ?? [];
    const hasMovement =
      isNonZero(row.startBalance) ||
      isNonZero(row.endBalance) ||
      isNonZero(row.debitTurnover) ||
      isNonZero(row.creditTurnover);
    if (!hasMovement && contracts.length === 0) continue;

    const linesDone = contracts.reduce((s, c) => s + c.fulfillment.done, 0);
    const linesTotal = contracts.reduce((s, c) => s + c.fulfillment.total, 0);
    clients.push({
      clientId: row.clientId,
      clientName: clientNameFromData(
        data,
        row.clientId,
        contracts[0]?.clientName,
      ),
      startBalance: row.startBalance,
      debitTurnover: row.debitTurnover,
      creditTurnover: row.creditTurnover,
      endBalance: row.endBalance,
      contracts,
      linesDone,
      linesTotal,
    });
  }

  clients.sort((a, b) => {
    const byDebt = Math.abs(b.endBalance) - Math.abs(a.endBalance);
    if (byDebt !== 0) return byDebt;
    return a.clientName.localeCompare(b.clientName, "ru");
  });

  const summary = emptySummary();
  summary.clientsTotal = clients.length;
  for (const client of clients) {
    if (client.contracts.length > 0) summary.withContract += 1;
    else summary.withoutContract += 1;
    if (isNonZero(client.startBalance)) summary.withStartDebt += 1;
    if (isNonZero(client.endBalance)) summary.withEndDebt += 1;
    summary.startBalanceTotal += client.startBalance;
    summary.endBalanceTotal += client.endBalance;
    summary.debitTurnoverTotal += client.debitTurnover;
    summary.creditTurnoverTotal += client.creditTurnover;
    summary.contractsTotal += client.contracts.length;
    summary.linesDone += client.linesDone;
    summary.linesTotal += client.linesTotal;
  }

  return {
    reportType: "ClientsContractsWork",
    values: { summary, clients },
  };
};
