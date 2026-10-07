import { DocumentModel, documentsWithTableItems, DocumentType } from '@/app/interfaces/document.interface';
import { numberValue } from '@/app/service/common/converters';

export const documentTotal = (item: DocumentModel) => {
    // Явно определяем, является ли документ документом с табличной частью
    const hasTableItems = documentsWithTableItems.includes(item.documentType);
    
    // Если это документ с табличной частью И docTableItems загружены
    if (hasTableItems && item.docTableItems?.length) {
        // Для ComeProduct берем только элементы с tableType === 'income' (приход готовой продукции)
        let itemsToSum = item.docTableItems;
        if (item.documentType === DocumentType.ComeProduct) {
            itemsToSum = item.docTableItems.filter(item => item.tableType === 'income' || !item.tableType);
        }
        return numberValue(itemsToSum.reduce((summa, item) => summa + item.total, 0));
    }
    
    // Для всех остальных случаев используем docValues.total
    // (для документов с табличной частью без загруженных items это будет предвычисленное значение на бэкенде)
    return numberValue(item.docValues?.total || 0);
}

export const totals = (item: DocumentModel) => {
    let total = item.docValues?.total;
    let count = item.docValues?.count;
    let totalCost = 0;

    if (( item.documentType == DocumentType.ComeProduct ||  item.documentType == DocumentType.SaleProd) 
        && item.docTableItems?.length ) {
        // Для ComeProduct берем только элементы с tableType === 'income' (приход готовой продукции)
        let itemsToSum = item.docTableItems;
        if (item.documentType === DocumentType.ComeProduct) {
            itemsToSum = item.docTableItems.filter(item => item.tableType === 'income' || !item.tableType);
        }
        
        let t = itemsToSum.reduce((summa, item) => summa + item.total, 0)
        total = t;
        let c = itemsToSum.reduce((count, item) => count + item.count, 0)
        count = c;  
        let cost = itemsToSum.reduce((summa, item) => summa + item.costTotal, 0)
        totalCost = cost;
    }

    return {t: total, c:count, cost: totalCost}
}

export const buildUrl = (contentName: string, dateStartForUrl: number, dateEndForUrl: number, enterpriseId?: number | null) => {
    const params = new URLSearchParams();
    
    if (enterpriseId !== undefined && enterpriseId !== null) {
        params.append('enterpriseId', enterpriseId.toString());
    }
    
    if (!contentName) {
        const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/all/`;
        return params.toString() ? `${url}?${params}` : url;
    }
    
    params.append('documentType', contentName);
    params.append('dateStart', dateStartForUrl.toString());
    params.append('dateEnd', dateEndForUrl.toString());
    
    return `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/byTypeForDate?${params}`;
}; 