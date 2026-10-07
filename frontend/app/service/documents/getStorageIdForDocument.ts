import { DocumentType } from "../../interfaces/document.interface";

export const getStorageIdForDocument = (documentType: string, senderId: number, receiverId: number): number => {

    const documentsWithCome = [
        `${DocumentType.ComeMaterial}`,
        `${DocumentType.ComeTools}`,
        `${DocumentType.ComeTovar}`,
        `${DocumentType.ComeHalfstuff}`,
        `${DocumentType.ComeProduct}`,
        `${DocumentType.ReceiveToolsFromClient}`,
      ]
      
      const documentsWithOut = [
        `${DocumentType.MoveProd}`,
        `${DocumentType.MoveMaterial}`,
        `${DocumentType.MoveTools}`,
        `${DocumentType.MoveHalfstuff}`,
        `${DocumentType.SaleMaterial}`,
        `${DocumentType.ComeOS}`,
        `${DocumentType.LeaveOS}`,
        `${DocumentType.MoveOS}`,
        `${DocumentType.SaleOS}`,
        `${DocumentType.AmortizasiyaOS}`,
        `${DocumentType.SaleHalfStuff}`,
        `${DocumentType.SaleProd}`,
        `${DocumentType.SaleTovar}`,
        `${DocumentType.SaleTools}`,
        `${DocumentType.LeaveMaterial}`,
        `${DocumentType.LeaveTools}`,
        `${DocumentType.LeaveTovar}`,
        `${DocumentType.TransferToolsToClient}`,
        `${DocumentType.OrderToolsToClient}`,
        `${DocumentType.LeaveOnlyOneMaterial}`,
        `${DocumentType.LeaveHalfstuff}`,
        `${DocumentType.LeaveProd}`,
      ]
      
      if (documentsWithOut.includes(documentType)) {
        return senderId
      }
    
      if (documentsWithCome.includes(documentType)) {
        return receiverId
      }
    
      return 0
}