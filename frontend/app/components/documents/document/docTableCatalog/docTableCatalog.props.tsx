import { DocTableItem, TypeDocumentByComeOut } from '@/app/interfaces/document.interface';
import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface DocTableCatalogProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    items: Array<DocTableItem> | undefined,
    typeDocumentByComeOut: TypeDocumentByComeOut
}