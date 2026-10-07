import { TypeReference, TypeSECTION, TypeTMZ, ProductionType } from 'src/interfaces/reference.interface';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { RefValues } from 'src/refvalues/refValues.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { EntriesService } from 'src/entries/entries.service';
import { DocumentsService } from 'src/documents/documents.service';
import { DocumentType, DocSTATUS } from 'src/interfaces/document.interface';
import { Document } from 'src/documents/document.model';
import { DocTableItems } from 'src/docTableItems/docTableItems.model';
import { DocValues } from 'src/docValues/docValues.model';
import { Entry } from 'src/entries/entry.model';
import { Schet } from 'src/interfaces/report.interface';
import { Pereodic } from 'src/pereodic/pereodic.model';
import { Op } from 'sequelize';
import { foydaByProductionItem } from './foydaByProductionItem';
import { getComeProductIncomeLines } from '../svod/helpers';

/**
 * Получает доходы по цехам на основе выпуска продукции (ComeProduct)
 * Доход = количество * thirdPrice товара
 * Группируется по цехам через senderId документа ComeProduct
 * thirdPrice берется из pereodic на дату конца отчета (endDate)
 */
const getIncomeByWorkshopsFromProduction = async (
    references: Reference[],
    startDate: number | null,
    endDate: number | null,
    documentsService: DocumentsService,
    sequelize: Sequelize,
    enterpriseId?: number | null
): Promise<Map<number, number>> => {
    const incomeByWorkshop = new Map<number, number>();
    
    if (!startDate || !endDate) {
        return incomeByWorkshop;
    }
    
    // Получаем все документы выпуска продукции с docTableItems
    // Используем прямой запрос, так как getAllDocumentsByType не загружает docTableItems для оптимизации
    const where: any = {
        documentType: DocumentType.ComeProduct
    };
    
    if (enterpriseId !== undefined && enterpriseId !== null) {
        where.enterpriseId = enterpriseId;
    }
    
    const comeProductDocs = await Document.findAll({
        where,
        include: [
            {
                model: DocValues,
                as: 'docValues'
            },
            {
                model: DocTableItems,
                as: 'docTableItems'
            }
        ],
        order: [
            ['date', 'ASC'],
            ['id', 'ASC']
        ]
    });
    
    // Фильтруем по дате
    const filteredDocs = comeProductDocs.filter((doc: any) => {
        const docDate = Number(doc.date);
        return docDate >= startDate && docDate <= endDate;
    });
    
    // Создаем карту товаров для быстрого поиска thirdPrice
    const productsById = new Map<number, Reference>();
    const productRefs = references.filter((ref: Reference) => 
        ref.typeReference === TypeReference.TMZ && 
        ref.refValues?.typeTMZ === TypeTMZ.PRODUCT
    );
    
    for (const product of productRefs) {
        if (product.id) {
            productsById.set(product.id, product);
        }
    }
    
    // Загружаем все периодические значения thirdPrice для всех товаров до endDate
    const productIds = Array.from(productsById.keys());
    const thirdPriceMap = new Map<number, Map<number, number>>(); // Map<productId, Map<date, thirdPrice>>
    
    if (productIds.length > 0 && endDate) {
        try {
            const where: any = {
                referenceId: { [Op.in]: productIds },
                name: 'thirdPrice',
                date: { [Op.lte]: endDate } // Загружаем все значения до endDate
            };
            
            // Добавляем фильтр по enterpriseId если передан
            if (enterpriseId !== undefined && enterpriseId !== null) {
                where[Op.or] = [
                    { enterpriseId: enterpriseId },
                    { enterpriseId: null }
                ];
            } else {
                where.enterpriseId = null;
            }
            
            const allPereodics = await Pereodic.findAll({
                where,
                order: [['referenceId', 'ASC'], ['date', 'ASC']]
            });
            
            // Группируем по товарам и датам
            for (const pereodic of allPereodics) {
                const refId = pereodic.referenceId;
                const date = Number(pereodic.date);
                const value = pereodic.value || 0;
                
                if (!thirdPriceMap.has(refId)) {
                    thirdPriceMap.set(refId, new Map());
                }
                thirdPriceMap.get(refId)!.set(date, value);
            }
        } catch (error) {
        }
    }
    
    // Функция для получения thirdPrice для товара на дату конца отчета (endDate)
    const getThirdPriceForEndDate = (productId: number): number => {
        // Сначала проверяем refValues
        const product = productsById.get(productId);
        if (product?.refValues?.thirdPrice) {
            return product.refValues.thirdPrice;
        }
        
        // Затем ищем в периодических значениях на дату конца отчета
        const pereodicMap = thirdPriceMap.get(productId);
        if (pereodicMap && pereodicMap.size > 0) {
            // Находим последнее значение до даты конца отчета
            let lastValue = 0;
            let lastDate = 0;
            for (const [pereodicDate, value] of pereodicMap.entries()) {
                if (pereodicDate <= endDate && pereodicDate > lastDate) {
                    lastDate = pereodicDate;
                    lastValue = value;
                }
            }
            return lastValue;
        }
        
        return 0;
    };
    
    let totalIncomeAmount = 0;
    let processedItems = 0;
    let skippedNoProduct = 0;
    let skippedNoThirdPrice = 0;
    let skippedNoWorkshop = 0;
    
    // Обрабатываем каждый документ
    let docsWithItems = 0;
    let docsWithoutItems = 0;
    
    for (const doc of filteredDocs) {
        const incomeLines = getComeProductIncomeLines(doc);
        if (!incomeLines.length) {
            docsWithoutItems++;
            continue;
        }
        
        // Определяем цех по senderId документа ComeProduct
        const workshopId = doc.docValues?.senderId;
        if (!workshopId) {
            skippedNoWorkshop++;
            continue;
        }
        
        docsWithItems++;
        if (docsWithItems <= 3) {
            console.log(`[FoydaByProduction] Обрабатываем документ ${doc.id}, цех=${workshopId}, позиций: ${incomeLines.length}`);
        }
        
        for (const line of incomeLines) {
            const productId = line.analiticId;
            const count = line.count;
            
            if (!productId) {
                skippedNoProduct++;
                if (skippedNoProduct <= 3) {
                    console.log(`[FoydaByProduction] Пропущен элемент таблицы: нет analiticId, count=${count}`);
                }
                continue;
            }
            
            if (count === 0) {
                if (skippedNoProduct <= 3) {
                    console.log(`[FoydaByProduction] Пропущен элемент таблицы: count=0, productId=${productId}`);
                }
                continue;
            }
            
            // Находим товар
            const product = productsById.get(productId);
            if (!product) {
                skippedNoProduct++;
                if (skippedNoProduct <= 3) {
                    console.log(`[FoydaByProduction] Товар ${productId} не найден в справочнике`);
                }
                continue;
            }
            
            // Получаем thirdPrice из refValues или из периодических значений на дату конца отчета
            const thirdPrice = getThirdPriceForEndDate(productId);
            
            if (!thirdPrice || thirdPrice === 0) {
                skippedNoThirdPrice++;
                if (skippedNoThirdPrice <= 3) {
                    console.log(`[FoydaByProduction] Товар ${productId} (${product.name}): thirdPrice=${thirdPrice || 'отсутствует'} на дату конца отчета ${endDate}`);
                }
                continue;
            }
            
            // Рассчитываем доход: количество * thirdPrice
            const income = count * thirdPrice;
            
            if (processedItems < 5) {
                console.log(`[FoydaByProduction] Обработан элемент: товар ${productId} (${product.name}), count=${count}, thirdPrice=${thirdPrice}, income=${income}, цех=${workshopId}`);
            }
            
            // Добавляем доход к цеху
            const currentIncome = incomeByWorkshop.get(workshopId) || 0;
            incomeByWorkshop.set(workshopId, currentIncome + income);
            
            totalIncomeAmount += income;
            processedItems++;
        }
    }
    
    console.log(`[FoydaByProduction] Документов с элементами таблицы: ${docsWithItems}`);
    console.log(`[FoydaByProduction] Документов без элементов таблицы: ${docsWithoutItems}`);
    
    console.log('[FoydaByProduction] Статистика обработки выпуска продукции:');
    console.log('- Общая сумма доходов:', totalIncomeAmount);
    console.log('- Обработано элементов:', processedItems);
    console.log('- Пропущено без productId:', skippedNoProduct);
    console.log('- Пропущено без цеха:', skippedNoWorkshop);
    console.log('- Пропущено без thirdPrice:', skippedNoThirdPrice);
    console.log('- Найдено цехов с доходами:', incomeByWorkshop.size);
    
    // Детальная статистика по каждому цеху
    console.log('[FoydaByProduction] Детальная статистика по цехам:');
    for (const [workshopId, income] of incomeByWorkshop.entries()) {
        console.log(`- Цех ID ${workshopId}: доход=${income}`);
    }
    
    return incomeByWorkshop;
};

/**
 * Получает доходы по цехам из проводок Дебет (40/41/60) - Кредит 90
 * Доходы группируются по продукции (kreditSecondSubcontoId), 
 * затем связываются с цехами через группу второго уровня продукции
 * @deprecated Используется getIncomeByWorkshopsFromProduction вместо этого
 */
const getIncomeByWorkshops = async (
    entries: Entry[],
    references: Reference[],
    startDate: number | null,
    endDate: number | null
): Promise<Map<number, number>> => {
    const incomeByWorkshop = new Map<number, number>();
    
    // Создаем карту всех элементов TMZ (продукты и группы) для быстрого поиска
    const tmzById = new Map<number, Reference>();
    const tmzItems = references.filter((ref: Reference) => 
        ref.typeReference === TypeReference.TMZ
    );
    
    for (const item of tmzItems) {
        if (item.id) {
            tmzById.set(item.id, item);
        }
    }
    
    // Функция для извлечения ID цеха из comment
    const extractWorkshopIdFromComment = (comment: string): number | null => {
        if (!comment) return null;
        
        // Пробуем парсить как JSON
        try {
            const parsed = JSON.parse(comment);
            if (typeof parsed === 'object' && parsed !== null) {
                if (parsed.id !== undefined) {
                    const id = typeof parsed.id === 'number' ? parsed.id : parseInt(String(parsed.id), 10);
                    if (!isNaN(id) && id > 0) return id;
                }
                // Также проверяем другие возможные поля
                if (parsed.workshopId !== undefined) {
                    const id = typeof parsed.workshopId === 'number' ? parsed.workshopId : parseInt(String(parsed.workshopId), 10);
                    if (!isNaN(id) && id > 0) return id;
                }
            }
        } catch {
            // Не JSON, пробуем как число
        }
        
        // Если не JSON, пробуем как число
        const numValue = parseInt(String(comment).trim(), 10);
        if (!isNaN(numValue) && numValue > 0) {
            return numValue;
        }
        
        return null;
    };
    
    // Функция для поиска ID цеха в группах
    // Логика: поднимаемся до корня (Махсулотлар), затем берем прямую дочернюю группу (ПБ плита, Бетон и т.д.)
    // В этой группе ищем ID цеха в comment
    // Структура: Махсулотлар (корень) -> ПБ плита/Бетон/ПК плита (прямая дочерняя группа с comment) -> продукт
    const findWorkshopIdFromProduct = (productId: number, skipCount: number): { workshopId: number | null; path: Array<{ id: number; name: string; comment?: string }> } => {
        let currentId: number | undefined = productId;
        let safety = 0;
        const path: Array<{ id: number; name: string; comment?: string }> = [];
        let directChildOfRoot: Reference | null = null; // Прямая дочерняя группа корня (ПБ плита, Бетон и т.д.)
        
        // Шаг 1: Поднимаемся до корня, запоминая путь
        while (currentId !== undefined && safety < 100) {
            const node = tmzById.get(currentId);
            if (!node) {
                if (skipCount <= 5) {
                    console.log(`[FoydaByProduction] Продукт ${productId}: узел ${currentId} не найден в справочнике`);
                }
                break;
            }
            
            path.push({
                id: node.id,
                name: node.name,
                comment: node.refValues?.comment
            });
            
            const parentId = node.parentId;
            
            // Проверяем, является ли родитель корнем (parentId = null/undefined/0)
            if (parentId === null || parentId === undefined || parentId === 0) {
                // Текущий узел - это корень (Махсулотлар)
                // Предыдущий узел (который мы только что добавили в path) - это прямая дочерняя группа корня
                // Но нам нужен предыдущий узел, а не текущий
                // Поэтому нужно взять предпоследний элемент из path
                if (path.length > 1) {
                    // Предпоследний элемент - это прямая дочерняя группа корня
                    const directChildId = path[path.length - 2].id;
                    directChildOfRoot = tmzById.get(directChildId) || null;
                }
                break;
            }
            
            // Проверяем, является ли родитель корнем (т.е. следующий узел будет корнем)
            const parentNode = tmzById.get(parentId);
            if (parentNode && (parentNode.parentId === null || parentNode.parentId === undefined || parentNode.parentId === 0)) {
                // Родитель - это корень, значит текущий узел - прямая дочерняя группа корня
                directChildOfRoot = node;
            }
            
            currentId = parentId;
            safety++;
        }
        
        // Шаг 2: Проверяем прямую дочернюю группу корня (ПБ плита, Бетон и т.д.)
        if (directChildOfRoot && directChildOfRoot.refValues?.comment) {
            const workshopId = extractWorkshopIdFromComment(directChildOfRoot.refValues.comment);
            if (workshopId) {
                if (skipCount <= 5) {
                    console.log(`[FoydaByProduction] Продукт ${productId}: найден цех ${workshopId} в группе "${directChildOfRoot.name}" (прямой потомок корня), comment: ${directChildOfRoot.refValues.comment}`);
                }
                return { workshopId, path };
            } else {
                if (skipCount <= 5) {
                    console.log(`[FoydaByProduction] Продукт ${productId}: группа "${directChildOfRoot.name}" имеет comment, но ID цеха не извлечен:`, directChildOfRoot.refValues.comment);
                }
            }
        }
        
        // Если не нашли цех, логируем путь только для первых примеров
        if (skipCount <= 5 && path.length > 0) {
            console.log(`[FoydaByProduction] Продукт ${productId}: не найден цех. Путь по дереву:`, path.map(p => `${p.name} (id:${p.id}${p.comment ? `, comment:${p.comment}` : ''})`).join(' -> '));
            if (directChildOfRoot) {
                console.log(`[FoydaByProduction] Прямая дочерняя группа корня: "${directChildOfRoot.name}" (id:${directChildOfRoot.id}), comment: ${directChildOfRoot.refValues?.comment || 'отсутствует'}`);
            } else {
                console.log(`[FoydaByProduction] Прямая дочерняя группа корня не определена`);
            }
        } else if (skipCount <= 5) {
            console.log(`[FoydaByProduction] Продукт ${productId}: не найден в справочнике`);
        }
        
        return { workshopId: null, path };
    };
    
    // Фильтруем проводки доходов
    const incomeEntries = entries.filter((entry: Entry) => {
        const date = Number(entry.date);
        const isDateInRange = startDate && endDate 
            ? date >= startDate && date <= endDate 
            : true;
        
        const isIncomeEntry = 
            (entry.debet === Schet.S40 || entry.debet === Schet.S41 || entry.debet === Schet.S60) &&
            entry.kredit === Schet.S90;
        
        return isDateInRange && isIncomeEntry && entry.kreditSecondSubcontoId;
    });
    
    console.log('[FoydaByProduction] Всего проводок доходов найдено:', incomeEntries.length);
    console.log('[FoydaByProduction] Диапазон дат:', { startDate, endDate });
    
    // Статистика для анализа
    let totalIncomeAmount = 0;
    let processedCount = 0;
    let skippedNoProduct = 0;
    let skippedNoWorkshop = 0;
    const workshopStats = new Map<number, { count: number; total: number }>();
    
    // Группируем доходы по цехам
    for (const entry of incomeEntries) {
        const productId = entry.kreditSecondSubcontoId;
        const entryTotal = Number(entry.total) || 0;
        totalIncomeAmount += entryTotal;
        
        if (!productId) {
            skippedNoProduct++;
            // Логируем только первые 5 примеров
            if (skippedNoProduct <= 5) {
                console.log('[FoydaByProduction] Пропущена проводка без productId:', {
                    entryId: entry.id,
                    debet: entry.debet,
                    kredit: entry.kredit,
                    total: entryTotal,
                    date: entry.date
                });
            }
            continue;
        }
        
        // Находим ID цеха через группы продукта
        const { workshopId, path } = findWorkshopIdFromProduct(productId, skippedNoWorkshop);
        if (!workshopId) {
            skippedNoWorkshop++;
            // Логируем только первые 5 примеров
            if (skippedNoWorkshop <= 5) {
                console.log('[FoydaByProduction] Пропущена проводка - не найден цех для продукта:', {
                    entryId: entry.id,
                    productId: productId,
                    total: entryTotal,
                    date: entry.date,
                    path: path.map(p => p.name).join(' -> ')
                });
            }
            continue;
        }
        
        // Добавляем доход к цеху
        const currentIncome = incomeByWorkshop.get(workshopId) || 0;
        incomeByWorkshop.set(workshopId, currentIncome + entryTotal);
        
        // Статистика по цехам
        const stats = workshopStats.get(workshopId) || { count: 0, total: 0 };
        stats.count++;
        stats.total += entryTotal;
        workshopStats.set(workshopId, stats);
        
        processedCount++;
    }
    
    console.log('[FoydaByProduction] Статистика обработки доходов:');
    console.log('- Общая сумма всех проводок доходов:', totalIncomeAmount);
    console.log('- Обработано проводок:', processedCount);
    console.log('- Пропущено без productId:', skippedNoProduct);
    console.log('- Пропущено без цеха:', skippedNoWorkshop);
    console.log('- Найдено цехов с доходами:', incomeByWorkshop.size);
    console.log('- Сумма доходов по цехам:', Array.from(incomeByWorkshop.entries()).reduce((sum, [, val]) => sum + val, 0));
    
    // Детальная статистика по каждому цеху
    console.log('[FoydaByProduction] Детальная статистика по цехам:');
    for (const [workshopId, income] of incomeByWorkshop.entries()) {
        const stats = workshopStats.get(workshopId);
        console.log(`- Цех ID ${workshopId}: доход=${income}, проводок=${stats?.count || 0}, сумма=${stats?.total || 0}`);
    }
    
    return incomeByWorkshop;
};

/**
 * Получает доход для цеха "Бетон цех" на основе продаж товаров из ComeProduct
 * Логика:
 * 1. Берем все товары из документов ComeProduct (tableType === 'income') за период отчета, где senderId = цех "Бетон цех"
 * 2. Находим все документы SaleProd со статусом PROVEDEN за период отчета, содержащие эти товары
 * 3. Суммируем сумму продаж (total) этих товаров
 */
const getIncomeForBetonWorkshop = async (
    workshopId: number,
    references: Reference[],
    startDate: number | null,
    endDate: number | null,
    documentsService: DocumentsService,
    sequelize: Sequelize,
    enterpriseId?: number | null
): Promise<number> => {
    if (!startDate || !endDate) {
        return 0;
    }

    try {
        // Получаем товары бетона напрямую из базы данных, независимо от массива references
        // который может быть отфильтрован по правам доступа пользователя
        // ВАЖНО: Товары бетона выбираем БЕЗ фильтра по enterpriseId, так как они могут быть
        // заведены на уровне ADMINGLOBAL (enterpriseId = null) и должны использоваться для всех предприятий
        const betonProductWhere: any = {
            typeReference: TypeReference.TMZ
        };
        
        const betonProducts = await Reference.findAll({
            where: betonProductWhere,
            include: [
                {
                    model: RefValues,
                    as: 'refValues',
                    required: true,
                    where: {
                        typeTMZ: TypeTMZ.PRODUCT,
                        productionType: ProductionType.BETON,
                        [Op.or]: [
                            { markToDeleted: false },
                            { markToDeleted: null }
                        ]
                    }
                }
            ],
            attributes: ['id', 'name', 'enterpriseId']
        });
        
        const betonProductIds = new Set<number>();
        for (const product of betonProducts) {
            if (product.id) {
                betonProductIds.add(product.id);
            }
        }
        
        
        if (betonProductIds.size === 0) {
            console.log(`[FoydaByProduction] Для цеха "Бетон цех" не найдено товаров с productionType=BETON, возвращаем 0`);
            return 0;
        }
        
        // Получаем все документы SaleProd за период отчета с docTableItems
        // Используем прямой запрос, так как getAllDocumentsByType не загружает docTableItems для оптимизации
        // ВАЖНО: Фильтруем документы аналогично getAllDocumentsByType - учитываем межпредприятийные документы
        let saleWhere: any;
        
        if (enterpriseId !== undefined && enterpriseId !== null) {
            // Для конкретного предприятия учитываем:
            // 1. Обычные документы с enterpriseId = выбранное предприятие
            // 2. Межпредприятийные документы, где выбранное предприятие - отправитель
            // 3. Межпредприятийные документы, где выбранное предприятие - получатель (через documentTypeForReceiver)
            saleWhere = {
                [Op.or]: [
                    // Обычные документы пользователя
                    { enterpriseId: enterpriseId, documentType: DocumentType.SaleProd },
                    // Межпредприятийные документы, где пользователь - отправитель (ищем по documentType)
                    { isInterEnterprise: true, sourceEnterpriseId: enterpriseId, documentType: DocumentType.SaleProd },
                    // Межпредприятийные документы, где пользователь - получатель (ищем по documentTypeForReceiver)
                    // Исключаем документы со статусом OPEN (отмененные отправки)
                    {
                        isInterEnterprise: true,
                        targetEnterpriseId: enterpriseId,
                        documentTypeForReceiver: DocumentType.SaleProd,
                        docStatus: { [Op.ne]: DocSTATUS.OPEN }
                    }
                ]
            };
        } else {
            // Для ADMINGLOBAL (enterpriseId = null) показываем все документы SaleProd
            saleWhere = {
                [Op.or]: [
                    { documentType: DocumentType.SaleProd },
                    { isInterEnterprise: true, documentTypeForReceiver: DocumentType.SaleProd },
                    { isInterEnterprise: true, documentType: DocumentType.SaleProd }
                ]
            };
        }
        
        const saleProdDocs = await Document.findAll({
            where: saleWhere,
            include: [
                {
                    model: DocValues,
                    as: 'docValues'
                },
                {
                    model: DocTableItems,
                    as: 'docTableItems'
                }
            ],
            order: [
                ['date', 'ASC'],
                ['id', 'ASC']
            ]
        });
        
        // Фильтруем по статусу PROVEDEN и по дате периода отчета
        const provedenSaleProdDocs = saleProdDocs.filter((doc: any) => {
            const docDate = Number(doc.date);
            const isDateInRange = docDate >= startDate && docDate <= endDate;
            const isProveden = doc.docStatus === DocSTATUS.PROVEDEN;
            return isDateInRange && isProveden;
        });
        
        console.log(`[FoydaByProduction] Для цеха "Бетон цех" (ID: ${workshopId}):`);
        console.log(`  - Найдено документов SaleProd со статусом PROVEDEN за период отчета: ${provedenSaleProdDocs.length}`);
        
        // Суммируем сумму продаж товаров с productionType === BETON
        let totalIncome = 0;
        let processedItems = 0;
        let docsWithBetonProducts = 0;
        
        for (const doc of provedenSaleProdDocs) {
            if (!doc.docTableItems || doc.docTableItems.length === 0) {
                continue;
            }
            
            let docHasBetonProducts = false;
            let docIncome = 0;
            
            for (const tableItem of doc.docTableItems) {
                const productId = Number(tableItem.analiticId);
                if (!productId || Number.isNaN(productId)) {
                    continue;
                }
                
                // Если товар относится к типу BETON, суммируем его продажи (только положительные суммы)
                if (betonProductIds.has(productId)) {
                    const total = Number(tableItem.total) || 0;
                    if (total > 0) {
                        totalIncome += total;
                        docIncome += total;
                        processedItems++;
                        docHasBetonProducts = true;
                    }
                }
            }
            
            if (docHasBetonProducts) {
                docsWithBetonProducts++;
                if (docsWithBetonProducts <= 3) {
                    console.log(`[FoydaByProduction] Документ SaleProd содержит товары типа BETON: docId=${doc.id}, доход=${docIncome}`);
                }
            }
        }
        
        console.log(`[FoydaByProduction] Для цеха "Бетон цех" (ID: ${workshopId}):`);
        console.log(`  - Документов SaleProd с товарами типа BETON: ${docsWithBetonProducts}`);
        console.log(`  - Обработано элементов продаж: ${processedItems}`);
        console.log(`  - ИТОГО сумма дохода: ${totalIncome}`);
        
        return totalIncome;
    } catch (error) {
        console.error('[FoydaByProduction] Ошибка при получении дохода для цеха "Бетон цех":', error);
        return 0;
    }
};

export const foydaByProduction = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    stocksService: StocksService,
    oborotsService: OborotsService,
    entriesService: EntriesService,
    documentsService: DocumentsService,
    sequelize: Sequelize,
    enterpriseId?: number | null
) => {
    let result: any[] = [];
    
    // Фильтруем производственные цеха
    const productionWorkshops = data.filter((item: Reference) => 
        item?.typeReference === TypeReference.STORAGES && 
        item?.refValues?.typeSection === TypeSECTION.PRODUCTION &&
        !item.refValues.markToDeleted
    );
    
    // Отладочная информация для поиска общего цеха
    const allStorages = data.filter((item: Reference) => 
        item?.typeReference === TypeReference.STORAGES
    );
    console.log('[FoydaByProduction] Всего складов/цехов найдено:', allStorages.length);
    console.log('[FoydaByProduction] Производственных цехов найдено:', productionWorkshops.length);
    
    // Выводим информацию о всех складах для отладки
    allStorages.forEach((item: Reference) => {
        console.log(`[FoydaByProduction] Склад/цех: id=${item.id}, name="${item.name}", typeSection="${item.refValues?.typeSection}", markToDeleted=${item.refValues?.markToDeleted}`);
    });
    
    // Находим общий цех
    // Ищем цех с typeSection === COMMON и enterpriseId === enterpriseId
    console.log(`[FoydaByProduction] Поиск общего цеха для enterpriseId=${enterpriseId}`);
    
    let commonWorkshop = data.find((item: Reference) => {
        const isStorage = item?.typeReference === TypeReference.STORAGES;
        const isCommon = item?.refValues?.typeSection === TypeSECTION.COMMON;
        const itemEntId = item?.enterpriseId;
        const matchesEnterprise = enterpriseId ? itemEntId === enterpriseId : true;
        const notDeleted = !item.refValues?.markToDeleted;
        
        return isStorage && isCommon && matchesEnterprise && notDeleted;
    });
    
    if (!commonWorkshop && enterpriseId) {
        commonWorkshop = data.find((item: Reference) => {
            const isStorage = item?.typeReference === TypeReference.STORAGES;
            const isCommon = item?.refValues?.typeSection === TypeSECTION.COMMON;
            return isStorage && isCommon && item?.enterpriseId === enterpriseId;
        });
    }
    
    if (!commonWorkshop && enterpriseId) {
        commonWorkshop = data.find((item: Reference) => {
            const isStorage = item?.typeReference === TypeReference.STORAGES;
            const typeSectionString = String(item?.refValues?.typeSection || '').toUpperCase();
            return isStorage && typeSectionString === 'COMMON' && item?.enterpriseId === enterpriseId;
        });
    }
    
    if (commonWorkshop) {
        console.log(`[FoydaByProduction] Общий цех найден: id=${commonWorkshop.id}, name="${commonWorkshop.name}", typeSection="${commonWorkshop.refValues?.typeSection}", enterpriseId=${commonWorkshop.enterpriseId}, markToDeleted=${commonWorkshop.refValues?.markToDeleted}`);
    } else {
        console.log(`[FoydaByProduction] Общий цех НЕ найден для enterpriseId=${enterpriseId}!`);
        console.log('[FoydaByProduction] Проверяем все элементы с typeReference === STORAGES и typeSection === COMMON:');
        const commonStorages = allStorages.filter((item: Reference) => 
            item.refValues?.typeSection === TypeSECTION.COMMON
        );
        commonStorages.forEach((item: Reference) => {
            const typeSection = item.refValues?.typeSection;
            console.log(`  - id=${item.id}, name="${item.name}", typeSection="${typeSection}", enterpriseId=${item.enterpriseId}, markToDeleted=${item.refValues?.markToDeleted}`);
        });
    }
    
    // Получаем доходы по цехам на основе выпуска продукции (стандартная логика для всех цехов)
    const incomeByWorkshop = await getIncomeByWorkshopsFromProduction(data, startDate, endDate, documentsService, sequelize, enterpriseId);
    
    // Находим цех "Бетон цех" по ID
    const BETON_WORKSHOP_ID = 22399;
    const betonWorkshop = productionWorkshops.find((workshop: Reference) => 
        workshop.id === BETON_WORKSHOP_ID
    );
    
    if (betonWorkshop) {
        console.log(`[FoydaByProduction] ✅ Найден цех "Бетон цех": id=${betonWorkshop.id}, name="${betonWorkshop.name}"`);
    } else {
        console.log(`[FoydaByProduction] ⚠️ Цех "Бетон цех" с ID=${BETON_WORKSHOP_ID} НЕ найден среди ${productionWorkshops.length} производственных цехов`);
        console.log('[FoydaByProduction] Список всех производственных цехов:');
        productionWorkshops.forEach((workshop: Reference) => {
            console.log(`  - id=${workshop.id}, name="${workshop.name}"`);
        });
    }
    
    // Для каждого производственного цеха рассчитываем данные
    for (const workshop of productionWorkshops) {
        const workshopId = workshop.id;
        if (!workshopId) continue;
        
        let income: number;
        
        // Для цеха "Бетон цех" используем отдельную логику - доход из продаж товаров из ComeProduct
        if (betonWorkshop && workshopId === betonWorkshop.id) {
            console.log(`[FoydaByProduction] Используем специальную логику для цеха "Бетон цех" (ID: ${workshopId})`);
            income = await getIncomeForBetonWorkshop(workshopId, data, startDate, endDate, documentsService, sequelize, enterpriseId);
        } else {
            // Для остальных цехов используем стандартную логику (из getIncomeByWorkshopsFromProduction)
            income = incomeByWorkshop.get(workshopId) || 0;
        }
        
        // Получаем данные по цеху
        const item = await foydaByProductionItem(
            workshopId,
            workshop.name,
            income,
            startDate,
            endDate,
            oborotsService,
            enterpriseId
        );
        
        if (item) {
            result.push(item);
        }
    }
    
    console.log('[FoydaByProduction] Проверка условий для распределения расходов общего цеха:');
    console.log(`  - commonWorkshop существует: ${!!commonWorkshop}`);
    console.log(`  - commonWorkshop.id: ${commonWorkshop?.id}`);
    console.log(`  - Количество производственных цехов: ${result.length}`);
    console.log(`  - Условие выполнено: ${!!(commonWorkshop && commonWorkshop.id && result.length > 0)}`);
    
    // Распределяем расходы общего цеха поровну между всеми производственными цехами
    if (commonWorkshop && commonWorkshop.id && result.length > 0) {
        console.log(`[FoydaByProduction] Получаем расходы общего цеха (id=${commonWorkshop.id}, name="${commonWorkshop.name}")`);
        
        // Получаем расходы общего цеха
        const commonExpenses = await foydaByProductionItem(
            commonWorkshop.id,
            commonWorkshop.name,
            0, // доход = 0 для общего цеха
            startDate,
            endDate,
            oborotsService,
            enterpriseId
        );
        
        console.log('[FoydaByProduction] Расходы общего цеха получены:');
        console.log(`  - commonExpenses существует: ${!!commonExpenses}`);
        if (commonExpenses) {
            console.log(`  - cashExpenses: ${commonExpenses.cashExpenses || 0}`);
            console.log(`  - materialExpenses: ${commonExpenses.materialExpenses || 0}`);
            console.log(`  - productionExpenses: ${commonExpenses.productionExpenses || 0}`);
            console.log(`  - internalExpenses: ${commonExpenses.internalExpenses || 0}`);
            console.log(`  - supplierExpenses: ${commonExpenses.supplierExpenses || 0}`);
            console.log(`  - salaryExpenses: ${commonExpenses.salaryExpenses || 0}`);
        }
        
        if (commonExpenses) {
            // Считаем общие затраты перед распределением:
            // Это сумма всех типов расходов общего цеха (Дебет 20 - Кредит различных счетов)
            const totalCommonExpenses = 
                (commonExpenses.cashExpenses || 0) +      // Дебет 20 - Кредит 50 (денежные)
                (commonExpenses.materialExpenses || 0) +  // Дебет 20 - Кредит 10 (материальные)
                (commonExpenses.productionExpenses || 0) +  // Дебет 20 - Кредит 21 (производственные)
                (commonExpenses.internalExpenses || 0) +  // Дебет 20 - Кредит 41 (внутренние)
                (commonExpenses.supplierExpenses || 0) +  // Дебет 20 - Кредит 60 (от поставщиков)
                (commonExpenses.salaryExpenses || 0);     // Дебет 20 - Кредит 67 (заработная плата)
            
            console.log(`[FoydaByProduction] Общие расходы общего цеха (totalCommonExpenses): ${totalCommonExpenses}`);
            console.log(`[FoydaByProduction] Количество цехов для распределения: ${result.length}`);
            
            // Распределяем расходы поровну между всеми производственными цехами
            const expensesPerWorkshop = totalCommonExpenses / result.length;
            let totalDistributed = 0;
            
            for (let i = 0; i < result.length; i++) {
                const item = result[i];
                // Для всех цехов, кроме последнего, распределяем равную долю
                if (i < result.length - 1) {
                    item.distributedCommonExpenses = expensesPerWorkshop;
                    totalDistributed += expensesPerWorkshop;
                } else {
                    // Последнему цеху добавляем остаток (для компенсации округления)
                    item.distributedCommonExpenses = totalCommonExpenses - totalDistributed;
                }
                console.log(`[FoydaByProduction] Цех ${item.workshopId} (${item.workshopName}): распределено=${item.distributedCommonExpenses}`);
            }
            
            console.log(`[FoydaByProduction] Всего распределено: ${totalCommonExpenses}, расходов на цех: ${expensesPerWorkshop}`);
            
            // Рассчитываем общие расходы и прибыль для всех цехов
            for (const item of result) {
                item.totalExpenses = 
                    (item.cashExpenses || 0) +
                    (item.materialExpenses || 0) +
                    (item.internalExpenses || 0) +
                    (item.supplierExpenses || 0) +
                    (item.salaryExpenses || 0) +
                    (item.distributedCommonExpenses || 0);
                item.profit = (item.income || 0) - item.totalExpenses;
            }
        } else {
            console.log('[FoydaByProduction] commonExpenses вернул null или undefined');
        }
    } else {
        console.log('[FoydaByProduction] Условия для распределения расходов общего цеха НЕ выполнены!');
        console.log(`  - commonWorkshop: ${commonWorkshop ? 'существует' : 'не существует'}`);
        console.log(`  - commonWorkshop.id: ${commonWorkshop?.id || 'нет'}`);
        console.log(`  - Количество производственных цехов: ${result.length}`);
        
        // Если нет общего цеха или дохода, просто считаем прибыль без распределения
        for (const item of result) {
            item.totalExpenses = 
                (item.cashExpenses || 0) +
                (item.materialExpenses || 0) +
                (item.internalExpenses || 0) +
                (item.supplierExpenses || 0) +
                (item.salaryExpenses || 0);
            item.profit = (item.income || 0) - item.totalExpenses;
        }
    }
    
    return {
        reportType: 'FOYDABYPRODUCTION',
        values: [...result]
    };
};

