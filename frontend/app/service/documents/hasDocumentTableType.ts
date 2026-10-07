import { DocumentType, documentsWithTableItems } from "../../interfaces/document.interface";

export const hasDocumentTablePart = (documentType: string): Boolean => {
 

  if (documentsWithTableItems.includes(documentType)) {
    return true
  }

  const documentsWithOutTableItems = [
    `${DocumentType.ComeCashFromClients}`,
    `${DocumentType.MoveCash}`,
  ]

  if (documentsWithOutTableItems.includes(documentType)) {
    return false
  }

  return false



  // const documentsForZp = [
  //   `${DocumentType.ZpCalculate}`,
  // ]

  // if (documentsForZp.includes(documentType)) {
  //   senderType = TypeReference.STORAGES
  //   senderLabel = '-----'
  //   receiverType = TypeReference.STORAGES
  //   receiverLabel = 'Булим'
  //   paymentLabel = '------'
  //   paymentIsVisible = false
  //   tableIsVisible = true
  //   senderIsVisible = false
  //   recieverIsVisible = true
  // }

  return true

}