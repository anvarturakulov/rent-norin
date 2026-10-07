import { DetailedHTMLProps, HTMLAttributes } from "react";
import { DocumentModel } from "@/app/interfaces/document.interface";

export interface CheckProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  document: DocumentModel;
  references: any;
  onClose?: () => void;
}