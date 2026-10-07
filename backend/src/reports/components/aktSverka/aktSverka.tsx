import { TypeReference, TypePartners, TypeSECTION } from 'src/interfaces/reference.interface';
import { aktSverkaItem } from './aktSverka/aktSverkaItem';
import { Reference } from 'src/references/reference.model';
import { EntriesService } from 'src/entries/entries.service';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { Schet } from 'src/interfaces/report.interface';

// Функция для определения типа партнера по счету
const getPartnerTypeBySchet = (schet: Schet | null): TypePartners | null => {
    switch (schet) {
        case Schet.S40:
            return TypePartners.CLIENTS;
        case Schet.S60:
            return TypePartners.SUPPLIERS;
        case Schet.S41:
            return TypePartners.DEPARTMENTS;
        default:
            return null;
    }
};

export const aktSverka = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    selectedSchet: Schet | null,
    selectedPartnerId: number | null,
    entriesService: EntriesService,
    stocksService: StocksService,
    oborotsService: OborotsService,
    enterpriseId?: number | null
) => {
    let result: any[] = [];
    let filteredData: any[] = [];
    
    if (data && data.length > 0) {
        if (selectedPartnerId !== null && selectedPartnerId !== undefined) {
            // Специальный случай: selectedPartnerId === -1 означает "Барчаси" (Все) для DEPARTMENTS
            if (selectedPartnerId === -1 && selectedSchet === Schet.S41) {
                // Для "Барчаси" - находим все STORAGES с enterpriseId
                const allStorages = data.filter((item: Reference) => item?.typeReference === TypeReference.STORAGES);
                filteredData = allStorages.filter((item: any) => {
                    const entId = item?.enterpriseId;
                    const hasName = item?.name && item.name.trim() !== '';
                    return entId !== null && entId !== undefined && hasName;
                });
            } else {
                // Если выбран конкретный партнёр - фильтруем только по нему
                filteredData = data.filter((item: Reference) => item?.id == selectedPartnerId);
            }
        } else {
            // Если партнёр НЕ выбран - выводим всех партнёров данного типа
            const partnerType = getPartnerTypeBySchet(selectedSchet);
            
            if (partnerType) {
                if (partnerType === TypePartners.DEPARTMENTS) {
                    // Для DEPARTMENTS (S41) - показываем все STORAGES с enterpriseId !== null отдельно
                    const allStorages = data.filter((item: Reference) => item?.typeReference === TypeReference.STORAGES);
                    filteredData = allStorages.filter((item: any) => {
                        const entId = item?.enterpriseId;
                        const hasName = item?.name && item.name.trim() !== '';
                        return entId !== null && entId !== undefined && hasName;
                    });
                } else {
                    // Для CLIENTS и SUPPLIERS - фильтруем PARTNERS по typePartners
                    const allPartners = data.filter((item: Reference) => item?.typeReference === TypeReference.PARTNERS);
                    
                    filteredData = allPartners.filter((item: any) => {
                        const itemPartnerType = item?.refValues?.typePartners || item?.refValues?.dataValues?.typePartners;
                        return itemPartnerType === partnerType;
                    });
                }
            }
        }
    }
    
    // Специальная обработка для "Барчаси" (selectedPartnerId === -1) для DEPARTMENTS
    if (selectedPartnerId === -1 && selectedSchet === Schet.S41 && filteredData.length > 0) {
        // Объединяем все проводки по всем STORAGES в одну таблицу
        let allResults: any[] = [];
        let totalStartBalance = 0;
        let totalEndBalance = 0;
        
        // Создаем Set для хранения ID всех STORAGES в группе (для проверки дубликатов)
        const storageIdsSet = new Set(filteredData.map(item => item.id));
        
        // Создаем Map для отслеживания уникальных проводок (по ID проводки)
        const uniqueEntriesMap = new Map();
        
        for (const item of filteredData) {
            let element = await aktSverkaItem(startDate, endDate, item.id, item.name, selectedSchet, entriesService, stocksService, oborotsService, enterpriseId);
            
            // Собираем проводки, убирая дубликаты
            if (element?.results && Array.isArray(element.results)) {
                for (const entry of element.results) {
                    // Используем комбинацию полей для уникальности проводки
                    const entryKey = `${entry.id || entry.date}_${entry.debet}_${entry.kredit}_${entry.debetFirstSubcontoId}_${entry.kreditFirstSubcontoId}_${entry.total || 0}`;
                    
                    // Добавляем только если проводка еще не была добавлена
                    if (!uniqueEntriesMap.has(entryKey)) {
                        uniqueEntriesMap.set(entryKey, entry);
                        allResults.push(entry);
                    }
                }
            }
            
            // Суммируем остатки
            totalStartBalance += element?.startBalans || 0;
            totalEndBalance += element?.endBalans || 0;
        }
        
        // Создаем объединенный элемент с информацией о всех STORAGES
        const combinedElement = {
            section: 'Барчаси',
            startBalans: totalStartBalance,
            endBalans: totalEndBalance,
            sectionId: -1, // Специальный ID для "Барчаси"
            results: allResults,
            allStorageIds: Array.from(storageIdsSet) // Сохраняем список всех ID для проверки на фронтенде
        };
        
        // Проверяем, есть ли проводки или ненулевые остатки
        const hasEntries = allResults.length > 0;
        const hasNonZeroBalance = totalStartBalance !== 0 || totalEndBalance !== 0;
        
        // Добавляем только если есть проводки или ненулевые остатки
        if (hasEntries || hasNonZeroBalance) {
            result.push(combinedElement);
        }
    } else {
        // Обычная обработка - каждый элемент отдельно
        for (const item of filteredData) {
            let subcontoId: number | null = item.id;
            let partnerName = item.name;
            
            // Для DEPARTMENTS (S41) - item является STORAGES, используем его ID напрямую
            // Для CLIENTS и SUPPLIERS - item является PARTNERS, используем его ID
            let element = await aktSverkaItem(startDate, endDate, subcontoId, partnerName, selectedSchet, entriesService, stocksService, oborotsService, enterpriseId);
            
            // Проверяем, есть ли проводки или ненулевые остатки
            const hasEntries = element?.results && Array.isArray(element.results) && element.results.length > 0;
            const hasNonZeroBalance = (element?.startBalans && element.startBalans !== 0) || 
                                      (element?.endBalans && element.endBalans !== 0);
            
            // Добавляем только если есть проводки или ненулевые остатки
            if (hasEntries || hasNonZeroBalance) {
                result.push(element);
            }
        }
    }
    
    return {
        reportType: 'AKT_SVERKA',
        values: [...result]
    };
};
