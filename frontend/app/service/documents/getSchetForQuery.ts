import { DocumentType, DocumentTypeForReference } from "../../interfaces/document.interface";

export const getSchetForQuery = (contentName: string) : DocumentTypeForReference => {
  const documentsForMaterialWithOutLeave = [
    `${DocumentType.ComeMaterial}`,
    `${DocumentType.MoveMaterial}`,
    `${DocumentType.SaleMaterial}`,
    `${DocumentType.LeaveMaterial}`,
    `${DocumentType.LeaveOnlyOneMaterial}`,
    `${DocumentType.ComeHalfstuff}`,
  ]
  
  const documentsForProd = [
    `${DocumentType.ComeProduct}`,
    `${DocumentType.SaleProd}`,
    `${DocumentType.LeaveProd}`,
    `${DocumentType.MoveProd}`,
  ]
  
  const documentsForHalfstuff = [
    `${DocumentType.LeaveHalfstuff}`,
    `${DocumentType.MoveHalfstuff}`,
    `${DocumentType.SaleHalfStuff}`,
  ]

  const documentsForTovar = [
    `${DocumentType.ComeTovar}`,
    `${DocumentType.LeaveTovar}`,
    `${DocumentType.SaleTovar}`,
  ]

  const documentsForTools = [
    `${DocumentType.ComeTools}`,
    `${DocumentType.MoveTools}`,
    `${DocumentType.LeaveTools}`,
    `${DocumentType.SaleTools}`,
    `${DocumentType.TransferToolsToClient}`,
    `${DocumentType.OrderToolsToClient}`,
    `${DocumentType.ReceiveToolsFromClient}`,
  ]

  const documentsForOS = [
    `${DocumentType.ComeOS}`,
    `${DocumentType.LeaveOS}`,
    `${DocumentType.MoveOS}`,
    `${DocumentType.SaleOS}`,
    `${DocumentType.AmortizasiyaOS}`,
  ]

  if (documentsForOS.includes(contentName)) {
    return 'OS'
  }

  if (documentsForTools.includes(contentName)) {
    return 'TOOLS'
  }

  if (documentsForTovar.includes(contentName)) {
    return 'TOVAR'
  }

  if (documentsForMaterialWithOutLeave.includes(contentName)) {
    return 'MATERIAL'
  }

  if (documentsForProd.includes(contentName)) {
    return 'PRODUCT'
  }

  if (documentsForHalfstuff.includes(contentName)) {
    return 'HALFSTUFF'
  }

  return 'PRODUCT'
}