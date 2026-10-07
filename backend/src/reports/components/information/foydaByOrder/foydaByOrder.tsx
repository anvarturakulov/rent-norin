import { Op } from 'sequelize';
import { distributeAdditionalExpenses } from 'src/clientContracts/client-contracts.utils';
import { Schet } from 'src/interfaces/report.interface';
import { EntriesService } from 'src/entries/entries.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { FurnitureOrder } from 'src/furnitureOrders/furnitureOrder.model';
import { Reference } from 'src/references/reference.model';
import { foydaByOrderItem } from './foydaByOrderItem';

/**
 * Отчёт прибыли и рентабельности по заказам (мебельное производство).
 *
 * В отчёт попадают заказы с расходами на 20 счёте за период и/или с выручкой
 * (Дт 40/41 — Кт 90) за период. Себестоимость отгрузки (Дт 91 — Кт 28) не учитывается.
 *
 * Расходы собираются по 20 счёту в разрезе orderId проводки:
 *  - проводки с конкретным orderId -> прибыль по заказу
 *  - проводки с orderId IS NULL    -> отдельная строка "Общие расходы"
 */
export const foydaByOrder = async (
    startDate: number | null,
    endDate: number | null,
    oborotsService: OborotsService,
    entriesService: EntriesService,
    enterpriseId?: number | null,
) => {
    const result: any[] = [];

    if (!startDate || !endDate) {
        return { reportType: 'FOYDABYORDER', values: result };
    }

    // 1. Заказы с расходами на S20 и/или с выручкой за период
    const [orderIdsWithExpenses, orderIdsWithIncome] = await Promise.all([
        oborotsService.getOrderIdsWithExpenses(
            Schet.S20,
            startDate,
            endDate,
            enterpriseId,
        ),
        entriesService.getOrderIdsWithSaleIncome(
            startDate,
            endDate,
            enterpriseId,
        ),
    ]);

    const orderIds = [...new Set([...orderIdsWithExpenses, ...orderIdsWithIncome])].sort(
        (a, b) => a - b,
    );

    // 2. Загружаем сами заказы (номер, клиент, продукция, saleDocId)
    const orderWhere: any = {};
    if (enterpriseId !== undefined && enterpriseId !== null) {
        orderWhere.enterpriseId = enterpriseId;
    }
    if (orderIds.length > 0) {
        orderWhere.id = { [Op.in]: orderIds };
    }

    const orders =
        orderIds.length > 0
            ? await FurnitureOrder.findAll({
                  where: orderWhere,
                  include: [
                      { model: Reference, as: 'client', attributes: ['id', 'name'] },
                      { model: Reference, as: 'analitic', attributes: ['id', 'name'] },
                  ],
                  order: [['id', 'ASC']],
              })
            : [];

    const ordersById = new Map<number, FurnitureOrder>();
    for (const order of orders) {
        ordersById.set(Number(order.id), order);
    }

    // 3. Строка по каждому заказу
    for (const orderId of orderIds) {
        const order = ordersById.get(orderId);
        const clientName = order?.client?.name ? ` | ${order.client.name}` : '';
        const orderLabel = order
            ? `#${order.id}${order.orderNumber ? ` | №${order.orderNumber}` : ''}${clientName}${
                  order.analitic?.name ? ` | ${order.analitic.name}` : ''
              }`
            : `#${orderId}`;
        const saleDocId = order?.saleDocId ?? null;

        const item = await foydaByOrderItem(
            orderId,
            orderLabel,
            saleDocId,
            startDate,
            endDate,
            oborotsService,
            entriesService,
            enterpriseId,
        );
        if (item && (item.income > 0 || item.totalExpenses > 0)) {
            result.push(item);
        }
    }

    // 4. Распределение заказсиз расходов по заказам
    const overheadItem = await foydaByOrderItem(
        null,
        'Умумий харажатлар (заказсиз)',
        null,
        startDate,
        endDate,
        oborotsService,
        entriesService,
        enterpriseId,
    );

    const orderItems = result;
    const totalOverhead = overheadItem?.totalExpenses || 0;

    if (totalOverhead > 0 && orderItems.length > 0) {
        const bases = orderItems.map((item) => item.totalExpenses || 0);
        const totalBase = bases.reduce((sum, value) => sum + value, 0);
        const weights =
            totalBase > 0
                ? bases
                : orderItems.map((item) => item.income || 0);

        const distributed = distributeAdditionalExpenses(weights, totalOverhead);

        for (let i = 0; i < orderItems.length; i++) {
            const item = orderItems[i];
            const allocated = distributed[i] || 0;
            const directExpenses = item.totalExpenses || 0;
            item.distributedOverheadExpenses = allocated;
            item.totalExpenses = directExpenses + allocated;
            item.profit = (item.income || 0) - item.totalExpenses;
            item.profitability = item.income
                ? (item.profit / item.income) * 100
                : 0;
        }
    } else {
        for (const item of orderItems) {
            item.distributedOverheadExpenses = 0;
        }
    }

    if (overheadItem && totalOverhead > 0) {
        overheadItem.distributedOverheadExpenses = 0;
        result.push(overheadItem);
    }

    // 5. Доход без заказа (не раскидывается по заказам)
    const unallocatedIncome = await entriesService.getUnallocatedSaleIncome(
        startDate,
        endDate,
        enterpriseId,
    );
    if (unallocatedIncome > 0) {
        result.push({
            orderId: null,
            orderLabel: 'Умумий даромад (заказсиз)',
            saleDocId: null,
            income: unallocatedIncome,
            cashExpenses: 0,
            materialExpenses: 0,
            productionExpenses: 0,
            halfstuffExpenses: 0,
            supplierExpenses: 0,
            salaryExpenses: 0,
            totalExpenses: 0,
            profit: unallocatedIncome,
            profitability: 100,
            distributedOverheadExpenses: 0,
            isOverhead: false,
            isUnallocatedIncome: true,
        });
    }

    return {
        reportType: 'FOYDABYORDER',
        values: result,
    };
};
