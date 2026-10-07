import { DocumentType } from "@/app/interfaces/document.interface";

export const getDocumentTypeByComeOut = (documentType: DocumentType) => {
    const result = (documentType === DocumentType.ComeProduct || documentType === DocumentType.ComeMaterial || documentType === DocumentType.ComeTools || documentType === DocumentType.ComeTovar || documentType === DocumentType.ComeHalfstuff || documentType === DocumentType.ComeOS || documentType === DocumentType.ReceiveToolsFromClient || documentType === DocumentType.ReceiveSubleaseToolsFromClient) 
        ? 'come' 
        : 'out';
    
    console.log(`🔍 getDocumentTypeByComeOut: ${documentType} -> ${result}`);
    return result;
}
