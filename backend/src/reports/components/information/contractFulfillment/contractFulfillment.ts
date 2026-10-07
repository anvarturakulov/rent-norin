import {
  ContractFulfillmentRow,
  ContractFulfillmentSummary,
  ContractFulfillmentValues,
  loadMappedContracts,
} from "./contractFulfillment.mapper";

export type {
  FulfillmentState,
  ContractFulfillmentSaleDoc,
  ContractFulfillmentOrderLine,
  ContractFulfillmentItemLine,
  ContractFulfillmentRow,
  ContractFulfillmentSummary,
  ContractFulfillmentValues,
} from "./contractFulfillment.mapper";

const emptySummary = (): ContractFulfillmentSummary => ({
  contractsTotal: 0,
  fullyFulfilled: 0,
  inProgress: 0,
  notStarted: 0,
  empty: 0,
  linesTotal: 0,
  linesDone: 0,
  amountTotal: 0,
  amountFulfilled: 0,
});

const emptyValues = (): ContractFulfillmentValues => ({
  summary: emptySummary(),
  contracts: [],
});

function summarizeContracts(
  rows: ContractFulfillmentRow[],
): ContractFulfillmentSummary {
  const summary = emptySummary();
  summary.contractsTotal = rows.length;
  for (const row of rows) {
    if (row.fulfillment.state === "FULFILLED") summary.fullyFulfilled += 1;
    else if (row.fulfillment.state === "IN_PROGRESS") summary.inProgress += 1;
    else if (row.fulfillment.state === "NOT_STARTED") summary.notStarted += 1;
    else summary.empty += 1;
    summary.linesTotal += row.fulfillment.total;
    summary.linesDone += row.fulfillment.done;
    summary.amountTotal += row.amountTotal;
    summary.amountFulfilled += row.amountFulfilled;
  }
  return summary;
}

export const contractFulfillment = async (
  startDate: number | null,
  endDate: number | null,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: ContractFulfillmentValues }> => {
  if (!startDate || !endDate) {
    return { reportType: "ContractFulfillment", values: emptyValues() };
  }

  const rows = await loadMappedContracts({
    startDate,
    endDate,
    enterpriseId,
  });

  return {
    reportType: "ContractFulfillment",
    values: { summary: summarizeContracts(rows), contracts: rows },
  };
};
