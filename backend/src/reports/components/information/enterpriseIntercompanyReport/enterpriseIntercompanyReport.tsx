import { TypeReference } from 'src/interfaces/reference.interface';
import { Reference } from 'src/references/reference.model';
import { OborotsService } from 'src/oborots/oborots.service';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { queryKor } from '../../../querys/queryKor';
import { EnterprisesService } from 'src/enterprises/enterprises.service';
import { Enterprise } from 'src/enterprises/enterprise.model';

export interface EnterpriseIntercompanyReportItem {
    enterpriseId: number | null;
    enterpriseName: string;
    storageIds: number[];      // Список ID storages для этого предприятия
    receivedMoney: number;      // Колонка 1: Дебет 50, Кредит 41
    receivedMaterials: number; // Колонка 2: Дебет 10/21/28, Кредит 41 + Дебет 20, Кредит 41
    totalReceived: number;     // Колонка 3: Колонка 1 + Колонка 2
    gaveMaterials: number;     // Колонка 4: Дебет 41, Кредит 10/21/28/90
    gaveMoney: number;         // Колонка 5: Дебет 41, Кредит 50
    totalGave: number;         // Колонка 6: Колонка 4 + Колонка 5
}

export const enterpriseIntercompanyReport = async (
    data: any,
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    enterprisesService: EnterprisesService,
    enterpriseId?: number | null
) => {
    let result: EnterpriseIntercompanyReportItem[] = [];
    
    if (!data || !data.length) {
        return {
            reportType: 'ENTERPRISE_INTERCOMPANY_REPORT',
            values: [],
        };
    }

    // Фильтруем storages по типу и получаем уникальные enterpriseId
    const storages = data.filter((item: Reference) => {
        return (
            item &&
            item.typeReference === TypeReference.STORAGES &&
            item.refValues &&
            !item.refValues.markToDeleted &&
            item.enterpriseId !== null &&
            item.enterpriseId !== undefined
        );
    });

    // Группируем storages по enterpriseId
    const enterpriseStoragesMap = new Map<number, Reference[]>();
    
    storages.forEach((storage: Reference) => {
        const entId = storage.enterpriseId;
        if (entId !== null && entId !== undefined) {
            if (!enterpriseStoragesMap.has(entId)) {
                enterpriseStoragesMap.set(entId, []);
            }
            enterpriseStoragesMap.get(entId)!.push(storage);
        }
    });

    // Получаем все предприятия для получения названий
    const allEnterprises = await enterprisesService.findAll();
    const enterpriseMap = new Map<number, Enterprise>();
    allEnterprises.forEach(enterprise => {
        enterpriseMap.set(enterprise.id, enterprise);
    });

    // Для каждого предприятия рассчитываем показатели
    for (const [entId, storageList] of enterpriseStoragesMap) {
        const enterprise = enterpriseMap.get(entId);
        const enterpriseName = enterprise?.name || `Предприятие ${entId}`;

        // Инициализируем суммы для предприятия
        let receivedMoney = 0;
        let receivedMaterials = 0;
        let gaveMaterials = 0;
        let gaveMoney = 0;

        // Оказание услуг (Дт 41, Кт 90) - рассчитываем один раз для предприятия
        // В кредите 90 нет storage предприятия, в дебете 41 - storage партнера
        const enterpriseGaveServices = await queryKor(
            Schet.S41,
            Schet.S90,
            TypeQuery.ODS,
            startDate,
            endDate,
            null,
            null,
            null,
            oborotsService,
            entId
        );

        gaveMaterials += enterpriseGaveServices;

        // Для каждого storage рассчитываем операции
        // Операции рассчитываются внутри организации (фильтр по enterpriseId)
        // Счет S41 имеет только firstSubcontoId (одно субконто)
        for (const storage of storageList) {
            const storageId = storage.id;

            // Колонка 1: Сколько получил денег (Дебет 50, Кредит 41)
            // Storage предприятия в Дт 50 - это означает что предприятие ПОЛУЧИЛО деньги
            // Используем ODS для фильтрации по дебету
            const storageReceivedMoney = await queryKor(
                Schet.S50,
                Schet.S41,
                TypeQuery.ODS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId дебета (счет 50) - получил
                null,
                null,
                oborotsService,
                enterpriseId
            );

            receivedMoney += storageReceivedMoney;

            // Колонка 2: Сколько получил материалы (Дебет 10, Кредит 41) и услуги (Дебет 20, Кредит 41)
            // Storage предприятия в Дт 10/21/28 - это означает что предприятие ПОЛУЧИЛО материалы/продукцию
            // Используем ODS для фильтрации по дебету
            
            // Материалы (Дт 10, Кт 41)
            const storageReceivedMaterials = await queryKor(
                Schet.S10,
                Schet.S41,
                TypeQuery.ODS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId дебета (счет 10) - получил
                null,
                null,
                oborotsService,
                enterpriseId
            );

            // Полуфабрикаты (Дт 21, Кт 41)
            const storageReceivedHalfstuff = await queryKor(
                Schet.S21,
                Schet.S41,
                TypeQuery.ODS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId дебета (счет 21) - получил
                null,
                null,
                oborotsService,
                enterpriseId
            );

            // Готовая продукция (Дт 28, Кт 41)
            const storageReceivedProducts = await queryKor(
                Schet.S28,
                Schet.S41,
                TypeQuery.ODS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId дебета (счет 28) - получил
                null,
                null,
                oborotsService,
                enterpriseId
            );

            // Услуги (Дт 20, Кт 41)
            const storageReceivedServices = await queryKor(
                Schet.S20,
                Schet.S41,
                TypeQuery.ODS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId дебета (счет 20) - получил
                null,
                null,
                oborotsService,
                enterpriseId
            );

            receivedMaterials += storageReceivedMaterials + storageReceivedHalfstuff + storageReceivedProducts + storageReceivedServices;

            // Колонка 4: Сколько отдал материалы (Дебет 41, Кредит 10/21/28)
            // Storage предприятия находится в Кт 10/21/28 - это означает что предприятие ОТДАЛО
            // Используем OKS для фильтрации по кредиту
            
            // Готовая продукция (Дт 41, Кт 28)
            const storageGaveProducts = await queryKor(
                Schet.S41,
                Schet.S28,
                TypeQuery.OKS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId кредита (счет 28) - отдал
                null,
                null,
                oborotsService,
                enterpriseId
            );

            // Материалы (Дт 41, Кт 10) - межпредприятийное перемещение материалов
            const storageGaveMaterialsS10 = await queryKor(
                Schet.S41,
                Schet.S10,
                TypeQuery.OKS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId кредита (счет 10) - отдал
                null,
                null,
                oborotsService,
                enterpriseId
            );

            // Полуфабрикаты (Дт 41, Кт 21) - межпредприятийное перемещение полуфабрикатов
            const storageGaveHalfstuff = await queryKor(
                Schet.S41,
                Schet.S21,
                TypeQuery.OKS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId кредита (счет 21) - отдал
                null,
                null,
                oborotsService,
                enterpriseId
            );

            gaveMaterials += storageGaveProducts + storageGaveMaterialsS10 + storageGaveHalfstuff;

            // Колонка 5: Сколько отдал денег (Дебет 41, Кредит 50)
            // Storage предприятия в Кт 50 - это означает что предприятие ОТДАЛО деньги
            // Используем OKS для фильтрации по кредиту
            const storageGaveMoney = await queryKor(
                Schet.S41,
                Schet.S50,
                TypeQuery.OKS,
                startDate,
                endDate,
                storageId, // storage в firstSubcontoId кредита (счет 50) - отдал
                null,
                null,
                oborotsService,
                enterpriseId
            );

            gaveMoney += storageGaveMoney;
        }

        // Колонка 3: Итого сколько принял (Колонка 1 + Колонка 2)
        const totalReceived = receivedMoney + receivedMaterials;

        // Колонка 6: Итого сколько отдал (Колонка 4 + Колонка 5)
        const totalGave = gaveMaterials + gaveMoney;

        const storageIds = storageList.map(storage => storage.id);

        result.push({
            enterpriseId: entId,
            enterpriseName: enterpriseName,
            storageIds: storageIds,
            receivedMoney,
            receivedMaterials,
            totalReceived,
            gaveMaterials,
            gaveMoney,
            totalGave
        });
    }

    // Сортируем по ID предприятия
    result.sort((a, b) => {
        if (a.enterpriseId === null) return 1;
        if (b.enterpriseId === null) return -1;
        return (a.enterpriseId || 0) - (b.enterpriseId || 0);
    });

    return {
        reportType: 'ENTERPRISE_INTERCOMPANY_REPORT',
        values: result,
    };
};

