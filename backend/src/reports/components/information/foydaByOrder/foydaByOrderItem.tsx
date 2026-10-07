import { Schet } from 'src/interfaces/report.interface';
import { EntriesService } from 'src/entries/entries.service';
import { OborotsService } from 'src/oborots/oborots.service';

/**
 * Считает расходы по 20 счёту в разрезе одного заказа (или общих расходов).
 * orderId = number  -> конкретный заказ
 * orderId = null    -> общие/накладные расходы (проводки с orderId IS NULL)
 */
export const foydaByOrderItem = async (
    orderId: number | null,
    orderLabel: string,
    saleDocId: number | null | undefined,
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    entriesService: EntriesService,
    enterpriseId?: number | null,
) => {
    if (!startDate || !endDate) {
        return null;
    }

    const income =
        orderId != null
            ? await entriesService.getOrderSaleIncome(
                  orderId,
                  saleDocId,
                  startDate,
                  endDate,
                  enterpriseId,
              )
            : 0;

    const sumExpense = async (kredit: Schet): Promise<number> => {
        const { result } = await oborotsService.getOborotByDate(
            'TOTAL',
            startDate,
            endDate,
            Schet.S20,
            null, // debetFirstSubcontoId (любое подразделение)
            null,
            null,
            kredit,
            null,
            null,
            null,
            undefined,
            enterpriseId,
            orderId, // ключевой фильтр: заказ или NULL (общие расходы)
        );
        return result || 0;
    };

    const [
        cashExpenses,      // Дебет 20 - Кредит 50 (денежные)
        materialExpenses,  // Дебет 20 - Кредит 10 (материалы)
        productionExpenses,// Дебет 20 - Кредит 28 (готовая продукция)
        halfstuffExpenses, // Дебет 20 - Кредит 21 (полуфабрикаты, LeaveHalfstuff)
        supplierExpenses,  // Дебет 20 - Кредит 60 (поставщики / услуги партнёров)
        salaryExpenses,    // Дебет 20 - Кредит 67 (зарплата)
    ] = await Promise.all([
        sumExpense(Schet.S50),
        sumExpense(Schet.S10),
        sumExpense(Schet.S28),
        sumExpense(Schet.S21),
        sumExpense(Schet.S60),
        sumExpense(Schet.S67),
    ]);

    const totalExpenses =
        cashExpenses +
        materialExpenses +
        productionExpenses +
        halfstuffExpenses +
        supplierExpenses +
        salaryExpenses;

    const profit = (income || 0) - totalExpenses;
    const profitability = income ? (profit / income) * 100 : 0;

    return {
        orderId,
        orderLabel,
        saleDocId: saleDocId ?? null,
        income: income || 0,
        cashExpenses,
        materialExpenses,
        productionExpenses,
        halfstuffExpenses,
        supplierExpenses,
        salaryExpenses,
        totalExpenses,
        profit,
        profitability,
        distributedOverheadExpenses: 0,
        isOverhead: orderId === null,
    };
};
