export enum DocumentType {
  ComeMaterial = "ComeMaterial",
  ComeProduct = "ComeProduct",
  ComeHalfstuff = "ComeHalfstuff",

  SaleProd = "SaleProd",
  SaleMaterial = "SaleMaterial",
  SaleHalfStuff = "SaleHalfStuff",

  LeaveProd = "LeaveProd",
  LeaveMaterial = "LeaveMaterial",
  LeaveOnlyOneMaterial = "LeaveOnlyOneMaterial",
  LeaveHalfstuff = "LeaveHalfstuff",

  MoveProd = "MoveProd",
  MoveMaterial = "MoveMaterial",
  MoveHalfstuff = "MoveHalfstuff",

  ComeTools = "ComeTools",
  MoveTools = "MoveTools",
  LeaveTools = "LeaveTools",
  SaleTools = "SaleTools",

  ComeTovar = "ComeTovar",
  LeaveTovar = "LeaveTovar",
  SaleTovar = "SaleTovar",

  TransferToolsToClient = "TransferToolsToClient",
  OrderToolsToClient = "OrderToolsToClient",
  ReceiveToolsFromClient = "ReceiveToolsFromClient",
  TransferSubleaseToolsToClient = "TransferSubleaseToolsToClient",
  ReceiveSubleaseToolsFromClient = "ReceiveSubleaseToolsFromClient",

  ComeOS = "ComeOS",
  LeaveOS = "LeaveOS",
  MoveOS = "MoveOS",
  SaleOS = "SaleOS",
  AmortizasiyaOS = "AmortizasiyaOS",

  ComeCashFromClients = "ComeCashFromClients",
  MoveCash = "MoveCash",
  LeaveCash = "LeaveCash",
  Advance = "Advance",
  ZpCalculate = "ZpCalculate",
  TakeProfit = "TakeProfit",

  ServicesFromPartners = "ServicesFromPartners",
  ServicesToClients = "ServicesToClients",

  GateIncome = "GateIncome", // Накладная для входа

  FurnitureOrderMaterialLeave = "FurnitureOrderMaterialLeave", // Списание материалов по заявке на мебель
  FurnitureOrderSale = "FurnitureOrderSale", // Продажа/отгрузка по заявке на мебель

  Error = "Error",
}

export enum DocSTATUS {
  OPEN = "OPEN",
  PENDING = "PENDING",
  PROVEDEN = "PROVEDEN",
  REJECTED = "REJECTED",
  DELETED = "DELETED",
}

/** Тип часового тарифа аренды инструментов: наличка / физ.лицо или перечисление. */
export enum RentTariffType {
  CASH = "CASH",
  TRANSFER = "TRANSFER",
}

export const documentsWithTableItems = [
  `${DocumentType.ComeMaterial}`,
  `${DocumentType.LeaveMaterial}`,
  `${DocumentType.LeaveProd}`,
  `${DocumentType.LeaveHalfstuff}`,
  `${DocumentType.MoveProd}`,
  `${DocumentType.MoveMaterial}`,
  `${DocumentType.MoveHalfstuff}`,
  `${DocumentType.ComeTools}`,
  `${DocumentType.LeaveTools}`,
  `${DocumentType.MoveTools}`,
  `${DocumentType.SaleTools}`,
  `${DocumentType.ComeTovar}`,
  `${DocumentType.LeaveTovar}`,
  `${DocumentType.SaleTovar}`,
  `${DocumentType.TransferToolsToClient}`,
  `${DocumentType.OrderToolsToClient}`,
  `${DocumentType.ReceiveToolsFromClient}`,
  `${DocumentType.TransferSubleaseToolsToClient}`,
  `${DocumentType.ReceiveSubleaseToolsFromClient}`,
  `${DocumentType.SaleHalfStuff}`,
  `${DocumentType.SaleMaterial}`,
  `${DocumentType.SaleProd}`,
  `${DocumentType.ComeOS}`,
  `${DocumentType.LeaveOS}`,
  `${DocumentType.MoveOS}`,
  `${DocumentType.SaleOS}`,
  `${DocumentType.AmortizasiyaOS}`,
];
