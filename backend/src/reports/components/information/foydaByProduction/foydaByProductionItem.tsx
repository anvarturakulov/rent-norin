import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { queryKor } from 'src/reports/querys/queryKor';
import { OborotsService } from 'src/oborots/oborots.service';

export const foydaByProductionItem = async (
    workshopId: number,
    workshopName: string,
    income: number,
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    enterpriseId?: number | null
) => {
    if (!startDate || !endDate) {
        return null;
    }
    
    // Получаем расходы по 20 счету (debetFirstSubcontoId = цех)
    const [
        cashExpenses,      // Дебет 20 - Кредит 50 (денежные)
        materialExpenses,  // Дебет 20 - Кредит 10 (материальные)
        productionExpenses, // Дебет 20 - Кредит 21 (производственные)  
        internalExpenses,  // Дебет 20 - Кредит 41 (внутренние)
        supplierExpenses,  // Дебет 20 - Кредит 60 (от поставщиков)
        salaryExpenses    // Дебет 20 - Кредит 67 (заработная плата)

    ] = await Promise.all([
        queryKor(Schet.S20, Schet.S50, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId),
        queryKor(Schet.S20, Schet.S10, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId),
        queryKor(Schet.S20, Schet.S28, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId),
        queryKor(Schet.S20, Schet.S41, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId),
        queryKor(Schet.S20, Schet.S60, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId),
        queryKor(Schet.S20, Schet.S67, TypeQuery.ODS, startDate, endDate, workshopId, null, null, oborotsService, enterpriseId)
    ]);
    
    const currentExpenses = cashExpenses + materialExpenses + productionExpenses + internalExpenses + supplierExpenses + salaryExpenses;
    const currentProfit = income - currentExpenses;

    return {
        workshopId: workshopId,
        workshopName: workshopName,
        income: income || 0,
        cashExpenses: cashExpenses || 0,
        materialExpenses: materialExpenses || 0,
        productionExpenses: productionExpenses || 0,
        internalExpenses: internalExpenses || 0,
        supplierExpenses: supplierExpenses || 0,
        salaryExpenses: salaryExpenses || 0,
        currentExpenses: currentExpenses || 0,
        currentProfit: currentProfit || 0,
        distributedCommonExpenses: 0, // Будет рассчитано позже
        totalExpenses: 0, // Будет рассчитано позже
        profit: 0 // Будет рассчитано позже
    };
};

