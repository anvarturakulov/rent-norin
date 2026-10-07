import { DocumentType } from "../../interfaces/document.interface";

export const typeDocumentIsSale = (documentType: string): boolean => {

  const documentsWithTypelSale = [
    `${DocumentType.SaleProd}`,
    `${DocumentType.SaleTovar}`,
    `${DocumentType.SaleTools}`,
    `${DocumentType.SaleMaterial}`,
    `${DocumentType.SaleOS}`,
  ]

  if (documentsWithTypelSale.includes(documentType)) {
    return true
  }

  return false

}