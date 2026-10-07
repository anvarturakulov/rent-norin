import axios from 'axios';

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

export async function getToolsAtClientDetails(
  toolId: number,
  endDate: number,
  token: string | undefined,
  enterpriseId?: number | null,
): Promise<ToolsAtClientDetailsResult> {
  let url =
    `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/tools-current-balance/at-client-details?` +
    `toolId=${toolId}&endDate=${endDate}`;

  if (enterpriseId !== null && enterpriseId !== undefined) {
    url += `&enterpriseId=${enterpriseId}`;
  }

  const response = await axios.get<ToolsAtClientDetailsResult>(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
}
