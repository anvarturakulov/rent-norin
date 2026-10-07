import { DocumentType } from '@/app/interfaces/document.interface';

export interface ReadyRentalOrderLine {
  toolId: number;
  toolName: string;
  qty: number;
}

export interface ReadyRentalOrder {
  id: number;
  clientId: number;
  clientName: string;
  warehouseId: number;
  lines: ReadyRentalOrderLine[];
}

export interface ReadyRentalOrdersPayload {
  enoughForAll: boolean;
  orders: ReadyRentalOrder[];
}

export const emptyReadyRentalOrders = (): ReadyRentalOrdersPayload => ({
  enoughForAll: true,
  orders: [],
});

export const isRentalToolsContent = (contentName?: string | null): boolean =>
  contentName === DocumentType.OrderToolsToClient ||
  contentName === DocumentType.TransferToolsToClient ||
  contentName === DocumentType.ReceiveToolsFromClient;

export const buildReadyRentalOrdersHeaderText = (
  payload?: ReadyRentalOrdersPayload | null,
): string => {
  const orders = payload?.orders || [];
  if (!orders.length) return '';
  if (orders.length === 1) {
    return `Буюртма №${orders[0].id} ни ёпиш мумкин`;
  }
  if (payload?.enoughForAll) {
    return `${orders.length} буюртмани ёпиш мумкин`;
  }
  return `${orders.length} буюртмани алохида ёпиш мумкин`;
};

export const buildReadyRentalOrdersSummary = (
  payload?: ReadyRentalOrdersPayload | null,
): { title: string; note: string } => {
  const orders = payload?.orders || [];
  if (!orders.length) {
    return { title: '', note: '' };
  }
  if (orders.length === 1) {
    return {
      title: 'Складда ускуна пайдо бўлди',
      note: `Буюртма №${orders[0].id} ни тўлиқ ёпиш мумкин.`,
    };
  }
  if (payload?.enoughForAll) {
    return {
      title: 'Складда ускуна пайдо бўлди',
      note: `Қуйидаги ${orders.length} буюртмани ёпиш мумкин.`,
    };
  }
  return {
    title: 'Складда ускуна пайдо бўлди',
    note: `Буюртмаларни алохида ёпиш мумкин. Ҳаммасига бир вақтда етмайди.`,
  };
};
