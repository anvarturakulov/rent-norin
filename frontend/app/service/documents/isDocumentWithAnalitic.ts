import { DocumentType } from "../../interfaces/document.interface";

export const isDocumentWithAnalitic = (documentType: string): boolean => {

    const documentsWithAnalitic = [
        `${DocumentType.LeaveCash}`,
        `${DocumentType.LeaveMaterial}`,
        `${DocumentType.LeaveTools}`,
        `${DocumentType.LeaveTovar}`,
        `${DocumentType.LeaveOS}`,
        `${DocumentType.LeaveOnlyOneMaterial}`,
        `${DocumentType.LeaveProd}`,
        `${DocumentType.LeaveHalfstuff}`,
        `${DocumentType.ZpCalculate}`,
        `${DocumentType.Advance}`,
      ]
      
      if (documentsWithAnalitic.includes(documentType)) 
        {
        return true
      }
    
      return false
}