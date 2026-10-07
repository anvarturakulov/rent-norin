import { DocTableItem } from '@/app/interfaces/document.interface';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface DocTableProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    typeReference: TypeReference,
    items: Array<DocTableItem> | undefined,
    useRealIndices?: boolean,
    /** Для ComeProduct: материалы редактируемые (количество, удаление). */
    editableExpense?: boolean,
    /** Если false — колонка «Цена» в строках expense только для чтения. Не передан — как editableExpense. */
    editableExpensePrice?: boolean,
    /** Открыть каталог для замены номенклатуры в строке (индекс в docTableItems). */
    onOpenCatalogForRow?: (documentRowIndex: number) => void;
}