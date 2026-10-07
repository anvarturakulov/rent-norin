import { useMemo } from 'react';
import styles from './enterpriseIntercompanyReport.module.css';
import { useAppContext } from '@/app/context/app.context';
import axios from 'axios';
import { showMessage } from '@/app/service/common/showMessage';
import { Schet } from '@/app/interfaces/report.interface';

interface EnterpriseIntercompanyReportProps {
    className?: string;
    data?: any[];
}

interface EnterpriseIntercompanyReportItem {
    enterpriseId: number | null;
    enterpriseName: string;
    storageIds: number[];
    receivedMoney: number;
    receivedMaterials: number;
    totalReceived: number;
    gaveMaterials: number;
    gaveMoney: number;
    totalGave: number;
}

export const EnterpriseIntercompanyReport = ({ className, data, ...props }: EnterpriseIntercompanyReportProps): JSX.Element => {
    const { mainData, setMainData } = useAppContext();
    const { dateStart, dateEnd } = mainData.journal.interval;
    const { user } = mainData.users;
    const { selectedEnterpriseId } = mainData.report;

    // Получаем данные отчета
    const reportData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        const report = data.find((item: any) => item?.reportType === 'ENTERPRISE_INTERCOMPANY_REPORT');
        return report?.values || [];
    }, [data]);

    // Форматируем число для отображения
    const formatNumber = (num: number): string => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    // Обработчик клика на ячейку для показа операций
    const handleCellClick = async (
        item: EnterpriseIntercompanyReportItem,
        columnType: 'receivedMoney' | 'receivedMaterials' | 'gaveMaterials' | 'gaveMoney',
        value: number
    ) => {
        if (!value || value === 0) return;

        const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
            ? (selectedEnterpriseId as any)?.id 
            : selectedEnterpriseId;

        // Используем enterpriseId из item, если selectedEnterpriseId не указан
        const finalEnterpriseId = enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number'
            ? enterpriseId
            : (item.enterpriseId !== null && item.enterpriseId !== undefined ? item.enterpriseId : null);

        console.log('handleCellClick:', { columnType, item, storageIds: item.storageIds, finalEnterpriseId });

        showMessage('Маълумот юкланмокда. Кутуб туринг', 'warm', setMainData);

        try {
            const config = {
                headers: { Authorization: `Bearer ${user?.token}` }
            };

            const buildBatchUrl = (
                debet: Schet,
                kredit: Schet,
                subcontoInDebet: boolean,
                storageIds: number[] | null,
                enterpriseIdForQuery: number | null
            ) => {
                const base = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries`;
                const hasStorages = Array.isArray(storageIds) && storageIds.length > 0;
                const params: string[] = [
                    `debet=${debet}`,
                    `kredit=${kredit}`,
                    `startDate=${dateStart}`,
                    `endDate=${dateEnd}`,
                    `subcontoInDebet=${subcontoInDebet}`
                ];

                if (hasStorages) {
                    params.push(`subcontoIds=${storageIds.join(',')}`);
                    return `${base}/batch?${params.join('&')}`;
                }

                if (enterpriseIdForQuery !== null && enterpriseIdForQuery !== undefined && typeof enterpriseIdForQuery === 'number') {
                    params.push(`enterpriseId=${enterpriseIdForQuery}`);
                }

                return `${base}?${params.join('&')}`;
            };

            switch (columnType) {
                case 'receivedMoney':
                    // Дт 50, Кт 41 - storage в кредите 41 (kreditFirstSubcontoId)
                    // В backend используется ODS, который фильтрует по дебету, но по логике storage должен быть в кредите 41
                    // Проверяем оба варианта: storage в дебете 50 и в кредите 41
                    if (item.storageIds && item.storageIds.length > 0) {
                        const urlCredit41 = buildBatchUrl(Schet.S50, Schet.S41, false, item.storageIds, finalEnterpriseId);
                        const urlDebet50 = buildBatchUrl(Schet.S50, Schet.S41, true, item.storageIds, finalEnterpriseId);

                        const receivedMoneyResponses = await Promise.all([
                            axios.get(urlCredit41, config),
                            axios.get(urlDebet50, config)
                        ]);
                        // Объединяем результаты и убираем дубликаты по docId
                        const allReceivedMoneyEntries = receivedMoneyResponses.flatMap((response: any) => response.data || []);
                        const uniqueEntries = Array.from(
                            new Map(allReceivedMoneyEntries.map((entry: any) => [entry.id || `${entry.docId}-${entry.date}`, entry])).values()
                        );
                        
                        const formattedEntries = uniqueEntries.map((entry: any) => ({
                            date: Number(entry.date),
                            docNumber: entry.docId ? Number(entry.docId) : 0,
                            docId: entry.docId ? String(entry.docId) : '',
                            documentType: entry.documentType,
                            debet: entry.debet,
                            debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                            debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                            kredit: entry.kredit,
                            kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                            kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                            count: entry.count || 0,
                            total: entry.total || 0,
                            description: entry.description || '',
                            fullDescription: entry.fullDescription || ''
                        }));
                        
                        if (setMainData) {
                            showMessage(formattedEntries, 'warm', setMainData);
                        }
                    } else {
                        // Если нет storageIds, запрашиваем по enterpriseId без фильтрации по storage
                        const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S50}&` +
                            `kredit=${Schet.S41}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const response = await axios.get(url, config);
                        const entries = response.data || [];
                        
                        const formattedEntries = entries.map((entry: any) => ({
                            date: Number(entry.date),
                            docNumber: entry.docId ? Number(entry.docId) : 0,
                            docId: entry.docId ? String(entry.docId) : '',
                            documentType: entry.documentType,
                            debet: entry.debet,
                            debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                            debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                            kredit: entry.kredit,
                            kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                            kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                            count: entry.count || 0,
                            total: entry.total || 0,
                            description: entry.description || '',
                            fullDescription: entry.fullDescription || ''
                        }));
                        
                        if (setMainData) {
                            showMessage(formattedEntries, 'warm', setMainData);
                        }
                    }
                    return;
                case 'receivedMaterials':
                    // Дт 10/20, Кт 41 - storage в кредите 41 (kreditFirstSubcontoId)
                    // В backend используется ODS, который фильтрует по дебету, но по логике storage должен быть в кредите 41
                    // Проверяем оба варианта: storage в дебете (10/20) и в кредите 41
                    if (item.storageIds && item.storageIds.length > 0) {
                        const urlMatCredit41 = buildBatchUrl(Schet.S10, Schet.S41, false, item.storageIds, finalEnterpriseId);
                        const urlMatDebet10 = buildBatchUrl(Schet.S10, Schet.S41, true, item.storageIds, finalEnterpriseId);
                        const urlServCredit41 = buildBatchUrl(Schet.S20, Schet.S41, false, item.storageIds, finalEnterpriseId);
                        const urlServDebet20 = buildBatchUrl(Schet.S20, Schet.S41, true, item.storageIds, finalEnterpriseId);

                        const receivedMaterialsResponses = await Promise.all([
                            axios.get(urlMatCredit41, config),
                            axios.get(urlMatDebet10, config),
                            axios.get(urlServCredit41, config),
                            axios.get(urlServDebet20, config)
                        ]);
                        // Объединяем результаты и убираем дубликаты по docId
                        const allReceivedMaterialsEntries = receivedMaterialsResponses.flatMap((response: any) => response.data || []);
                        const uniqueReceivedMaterialsEntries = Array.from(
                            new Map(allReceivedMaterialsEntries.map((entry: any) => [entry.id || `${entry.docId}-${entry.date}`, entry])).values()
                        );
                        
                        const formattedReceivedMaterialsEntries = uniqueReceivedMaterialsEntries.map((entry: any) => ({
                        date: Number(entry.date),
                        docNumber: entry.docId ? Number(entry.docId) : 0,
                        docId: entry.docId ? String(entry.docId) : '',
                        documentType: entry.documentType,
                        debet: entry.debet,
                        debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                        debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                        kredit: entry.kredit,
                        kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                        kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                        count: entry.count || 0,
                        total: entry.total || 0,
                        description: entry.description || '',
                        fullDescription: entry.fullDescription || ''
                    }));
                    
                    if (setMainData) {
                        showMessage(formattedReceivedMaterialsEntries, 'warm', setMainData);
                    }
                    } else {
                        // Если нет storageIds, запрашиваем по enterpriseId без фильтрации по storage
                        const materialsUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S10}&` +
                            `kredit=${Schet.S41}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const servicesUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S20}&` +
                            `kredit=${Schet.S41}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const [materialsResponse, servicesResponse] = await Promise.all([
                            axios.get(materialsUrl, config),
                            axios.get(servicesUrl, config)
                        ]);
                        
                        const allEntries = [...(materialsResponse.data || []), ...(servicesResponse.data || [])];
                        const formattedEntries = allEntries.map((entry: any) => ({
                            date: Number(entry.date),
                            docNumber: entry.docId ? Number(entry.docId) : 0,
                            docId: entry.docId ? String(entry.docId) : '',
                            documentType: entry.documentType,
                            debet: entry.debet,
                            debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                            debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                            kredit: entry.kredit,
                            kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                            kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                            count: entry.count || 0,
                            total: entry.total || 0,
                            description: entry.description || '',
                            fullDescription: entry.fullDescription || ''
                        }));
                        
                        if (setMainData) {
                            showMessage(formattedEntries, 'warm', setMainData);
                        }
                    }
                    return;
                case 'gaveMaterials':
                    // Дт 41, Кт 28/90 - storage в дебете 41 (или enterpriseId для S90)
                    if (item.storageIds && item.storageIds.length > 0) {
                    // Запрашиваем материалы Дт 41, Кт 28 для всех storages одним batch-запросом
                    const materialsUrl = buildBatchUrl(Schet.S41, Schet.S28, true, item.storageIds, finalEnterpriseId);
                    
                    // Также запрашиваем услуги Дт 41, Кт 90 по enterpriseId
                    const gaveServicesPromise = finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number'
                        ? axios.get(`${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S41}&` +
                            `kredit=${Schet.S90}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}&` +
                            `subcontoInDebet=false&` +
                            `enterpriseId=${finalEnterpriseId}`,
                            config)
                        : Promise.resolve({ data: [] });
                    
                    const gaveMaterialsResponses = await Promise.all([
                        axios.get(materialsUrl, config),
                        gaveServicesPromise
                    ]);
                    const allGaveMaterialsEntries = gaveMaterialsResponses.flatMap((response: any) => response.data || []);
                    
                    const formattedGaveMaterialsEntries = allGaveMaterialsEntries.map((entry: any) => ({
                        date: Number(entry.date),
                        docNumber: entry.docId ? Number(entry.docId) : 0,
                        docId: entry.docId ? String(entry.docId) : '',
                        documentType: entry.documentType,
                        debet: entry.debet,
                        debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                        debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                        kredit: entry.kredit,
                        kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                        kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                        count: entry.count || 0,
                        total: entry.total || 0,
                        description: entry.description || '',
                        fullDescription: entry.fullDescription || ''
                    }));
                    
                    if (setMainData) {
                        showMessage(formattedGaveMaterialsEntries, 'warm', setMainData);
                    }
                    } else {
                        // Если нет storageIds, запрашиваем по enterpriseId без фильтрации по storage
                        const materialsUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S41}&` +
                            `kredit=${Schet.S28}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const servicesUrl = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S41}&` +
                            `kredit=${Schet.S90}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const [materialsResponse, servicesResponse] = await Promise.all([
                            axios.get(materialsUrl, config),
                            axios.get(servicesUrl, config)
                        ]);
                        
                        const allEntries = [...(materialsResponse.data || []), ...(servicesResponse.data || [])];
                        const formattedEntries = allEntries.map((entry: any) => ({
                            date: Number(entry.date),
                            docNumber: entry.docId ? Number(entry.docId) : 0,
                            docId: entry.docId ? String(entry.docId) : '',
                            documentType: entry.documentType,
                            debet: entry.debet,
                            debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                            debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                            kredit: entry.kredit,
                            kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                            kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                            count: entry.count || 0,
                            total: entry.total || 0,
                            description: entry.description || '',
                            fullDescription: entry.fullDescription || ''
                        }));
                        
                        if (setMainData) {
                            showMessage(formattedEntries, 'warm', setMainData);
                        }
                    }
                    return;
                case 'gaveMoney':
                    // Дт 41, Кт 50 - storage в кредите 41
                    if (item.storageIds && item.storageIds.length > 0) {
                    
                    const url = buildBatchUrl(Schet.S41, Schet.S50, false, item.storageIds, finalEnterpriseId);
                    
                    const gaveMoneyResponses = await Promise.all([axios.get(url, config)]);
                    const allGaveMoneyEntries = gaveMoneyResponses.flatMap((response: any) => response.data || []);
                    
                    const formattedGaveMoneyEntries = allGaveMoneyEntries.map((entry: any) => ({
                        date: Number(entry.date),
                        docNumber: entry.docId ? Number(entry.docId) : 0,
                        docId: entry.docId ? String(entry.docId) : '',
                        documentType: entry.documentType,
                        debet: entry.debet,
                        debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                        debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                        kredit: entry.kredit,
                        kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                        kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                        count: entry.count || 0,
                        total: entry.total || 0,
                        description: entry.description || '',
                        fullDescription: entry.fullDescription || ''
                    }));
                    
                    if (setMainData) {
                        showMessage(formattedGaveMoneyEntries, 'warm', setMainData);
                    }
                    } else {
                        // Если нет storageIds, запрашиваем по enterpriseId без фильтрации по storage
                        const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/intercompany-entries?` +
                            `debet=${Schet.S41}&` +
                            `kredit=${Schet.S50}&` +
                            `startDate=${dateStart}&` +
                            `endDate=${dateEnd}` +
                            (finalEnterpriseId !== null && finalEnterpriseId !== undefined && typeof finalEnterpriseId === 'number' 
                                ? `&enterpriseId=${finalEnterpriseId}` 
                                : '');
                        
                        const response = await axios.get(url, config);
                        const entries = response.data || [];
                        
                        const formattedEntries = entries.map((entry: any) => ({
                            date: Number(entry.date),
                            docNumber: entry.docId ? Number(entry.docId) : 0,
                            docId: entry.docId ? String(entry.docId) : '',
                            documentType: entry.documentType,
                            debet: entry.debet,
                            debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
                            debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
                            kredit: entry.kredit,
                            kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
                            kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
                            count: entry.count || 0,
                            total: entry.total || 0,
                            description: entry.description || '',
                            fullDescription: entry.fullDescription || ''
                        }));
                        
                        if (setMainData) {
                            showMessage(formattedEntries, 'warm', setMainData);
                        }
                    }
                    return;
            }
        } catch (error: any) {
            console.error('Ошибка при загрузке проводок:', error);
            if (setMainData) {
                showMessage(error.message || 'Ошибка при загрузке проводок', 'error', setMainData);
            }
        }
    };

    if (!reportData || reportData.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.noData}>
                    Нет данных для отображения
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container} {...props}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.enterpriseColumn}>Корхона</th>
                        <th className={styles.numberColumn}>Пул олган</th>
                        <th className={styles.numberColumn}>Материал ва хизмат олган</th>
                        <th className={`${styles.numberColumn} ${styles.totalColumn}`}>Жами олгани</th>
                        <th className={styles.numberColumn}>Материал ва хизмат берган</th>
                        <th className={styles.numberColumn}>Пул берган</th>
                        <th className={`${styles.numberColumn} ${styles.totalColumn}`}>Жами бергани</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map((item: EnterpriseIntercompanyReportItem, index: number) => (
                        <tr key={item.enterpriseId || index}>
                            <td className={styles.enterpriseColumn}>{item.enterpriseName}</td>
                            <td 
                                className={`${styles.numberColumn} ${item.receivedMoney !== 0 ? styles.clickable : ''}`}
                                onDoubleClick={() => handleCellClick(item, 'receivedMoney', item.receivedMoney)}
                                style={{ cursor: item.receivedMoney !== 0 ? 'pointer' : 'default' }}
                                title={item.receivedMoney !== 0 ? 'Двойной клик для просмотра операций' : ''}
                            >
                                {formatNumber(item.receivedMoney)}
                            </td>
                            <td 
                                className={`${styles.numberColumn} ${item.receivedMaterials !== 0 ? styles.clickable : ''}`}
                                onDoubleClick={() => handleCellClick(item, 'receivedMaterials', item.receivedMaterials)}
                                style={{ cursor: item.receivedMaterials !== 0 ? 'pointer' : 'default' }}
                                title={item.receivedMaterials !== 0 ? 'Двойной клик для просмотра операций' : ''}
                            >
                                {formatNumber(item.receivedMaterials)}
                            </td>
                            <td className={`${styles.numberColumn} ${styles.totalColumn}`}><strong>{formatNumber(item.totalReceived)}</strong></td>
                            <td 
                                className={`${styles.numberColumn} ${item.gaveMaterials !== 0 ? styles.clickable : ''}`}
                                onDoubleClick={() => handleCellClick(item, 'gaveMaterials', item.gaveMaterials)}
                                style={{ cursor: item.gaveMaterials !== 0 ? 'pointer' : 'default' }}
                                title={item.gaveMaterials !== 0 ? 'Двойной клик для просмотра операций' : ''}
                            >
                                {formatNumber(item.gaveMaterials)}
                            </td>
                            <td 
                                className={`${styles.numberColumn} ${item.gaveMoney !== 0 ? styles.clickable : ''}`}
                                onDoubleClick={() => handleCellClick(item, 'gaveMoney', item.gaveMoney)}
                                style={{ cursor: item.gaveMoney !== 0 ? 'pointer' : 'default' }}
                                title={item.gaveMoney !== 0 ? 'Двойной клик для просмотра операций' : ''}
                            >
                                {formatNumber(item.gaveMoney)}
                            </td>
                            <td className={`${styles.numberColumn} ${styles.totalColumn}`}><strong>{formatNumber(item.totalGave)}</strong></td>
                        </tr>
                    ))}
                    {/* Итоговая строка */}
                    <tr className={styles.totalRow}>
                        <td className={styles.enterpriseColumn}><strong>ИТОГО</strong></td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.receivedMoney, 0)
                            )}</strong>
                        </td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.receivedMaterials, 0)
                            )}</strong>
                        </td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.totalReceived, 0)
                            )}</strong>
                        </td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.gaveMaterials, 0)
                            )}</strong>
                        </td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.gaveMoney, 0)
                            )}</strong>
                        </td>
                        <td className={styles.numberColumn}>
                            <strong>{formatNumber(
                                reportData.reduce((sum: number, item: EnterpriseIntercompanyReportItem) => sum + item.totalGave, 0)
                            )}</strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

