import { documentsWithTableItems } from "src/interfaces/document.interface";

export const hasTablePartInDocument = (documentType: string): boolean => {
  if (documentsWithTableItems.includes(documentType)) {
    return true;
  }

  return false;
};
