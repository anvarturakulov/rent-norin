'use client';

import { Fragment, useState } from 'react';
import { numberValue } from '@/app/service/common/converters';
import { MaterialPlanningProps } from './materialPlanning.props';
import styles from './materialPlanning.module.css';

export const MaterialPlanning = ({
  data,
  ...props
}: MaterialPlanningProps): JSX.Element => {
  const formatReportDate = (value: number | null | undefined): string => {
    if (!value) return '-';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU');
  };

  const formatDeadline = (value: number | null | undefined): string => {
    if (!value) return '-';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU');
  };

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const report = Array.isArray(data)
    ? data.find((item: any) => item?.reportType === 'MATERIALPLANNING')
    : null;
  const values = report?.values;
  const stockDateLabel = formatReportDate(values?.generatedAt);
  const materials = values?.materials ?? [];
  const totals = values?.totals;

  if (!values) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>Материаллар режалаштириш</div>
        <div className={styles.emptyMessage}>Маълумотлар юкланмоқда</div>
      </div>
    );
  }

  if (!materials.length) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>
          Материаллар режалаштириш (Омбор қолдиғи санаси: {stockDateLabel})
        </div>
        <div className={styles.emptyMessage}>Маълумот топилмади</div>
      </div>
    );
  }

  const toggleExpanded = (materialId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>
        Материаллар режалаштириш (Омбор қолдиғи санаси: {stockDateLabel})
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.center} ${styles.indexCol}`}>№</th>
            <th className={`${styles.center} ${styles.plusCol}`}>+</th>
            <th>Материал</th>
            <th>Артикул</th>
            <th className={styles.unitCol}>Улч. бир.</th>
            <th className={styles.numeric}>Колдик</th>
            <th className={styles.numeric}>Заказдаги сон</th>
            <th className={styles.numeric}>Сарфланган</th>
            <th className={styles.numeric}>Заказлар буйича талаб</th>
            <th className={styles.numeric}>Фарк</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material: any, index: number) => {
            const stock = Number(material.stockTotal) || 0;
            const required = Number(material.requiredTotal) || 0;
            const consumed = Number(material.consumedTotal) || 0;
            const realRequirement = Math.max(required - consumed, 0);
            const delta = stock - realRequirement;
            const isExpanded = expandedIds.has(Number(material.materialId));

            return (
              <Fragment key={material.materialId}>
                <tr>
                  <td className={`${styles.center} ${styles.indexCol}`}>
                    {index + 1}
                  </td>
                  <td className={`${styles.center} ${styles.plusCol}`}>
                    <button
                      type="button"
                      className={styles.expandButton}
                      onClick={() => toggleExpanded(Number(material.materialId))}
                    >
                      {isExpanded ? '-' : '+'}
                    </button>
                  </td>
                  <td>
                    {material.materialName}
                  </td>
                  <td>{material.article || '-'}</td>
                  <td className={styles.unitCol}>{material.uom || '-'}</td>
                  <td className={styles.numeric}>{numberValue(stock)}</td>
                  <td className={styles.numeric}>{numberValue(required)}</td>
                  <td className={styles.numeric}>{numberValue(consumed)}</td>
                  <td className={styles.numeric}>{numberValue(realRequirement)}</td>
                  <td
                    className={`${styles.numeric} ${
                      delta < 0 ? styles.negativeValue : ''
                    }`}
                  >
                    {numberValue(delta)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`details-${material.materialId}`}>
                    <td colSpan={10} className={styles.detailsCell}>
                      <table className={styles.detailsTable}>
                        <thead>
                          <tr>
                            <th className={`${styles.center} ${styles.indexCol}`}>№</th>
                            <th className={styles.plusCol}></th>
                            <th>Заказ</th>
                            <th>Мижоз</th>
                            <th className={styles.unitCol}></th>
                            <th>Махсулот</th>
                            <th className={styles.numeric}>Заказдаги сон</th>
                            <th className={styles.numeric}>Сарфланган</th>
                            <th className={styles.numeric}>Заказлар буйича талаб</th>
                            <th>Топшириш санаси</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(material.byOrders ?? []).length ? (
                            (material.byOrders ?? []).map((order: any, orderIndex: number) => {
                              const orderRequired = Number(order.requiredQty) || 0;
                              const orderConsumed = Number(order.consumedQty) || 0;
                              const orderNeed = Math.max(
                                orderRequired - orderConsumed,
                                0,
                              );
                              return (
                                <tr
                                  key={`${material.materialId}-${order.orderId}-${order.productId}`}
                                >
                                  <td className={`${styles.center} ${styles.indexCol}`}>
                                    {orderIndex + 1}
                                  </td>
                                  <td className={styles.plusCol}></td>
                                  <td>{order.orderNumber || `Заказ ${order.orderId}`}</td>
                                  <td>{order.clientName || '-'}</td>
                                  <td className={styles.unitCol}></td>
                                  <td>{order.productName || '-'}</td>
                                  <td className={styles.numeric}>
                                    {numberValue(orderRequired)}
                                  </td>
                                  <td className={styles.numeric}>
                                    {numberValue(orderConsumed)}
                                  </td>
                                  <td className={styles.numeric}>
                                    {numberValue(orderNeed)}
                                  </td>
                                  <td>{formatDeadline(order.deadlineDate)}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={10} className={styles.center}>
                                Нет детализации по заказам
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {totals && (
        <div className={styles.overallTotals}>
          Жами: Омбор {numberValue(totals.stockTotal ?? 0)} | Талаб{' '}
          {numberValue(totals.requiredTotal ?? 0)} | Сарф{' '}
          {numberValue(totals.consumedTotal ?? 0)} | Қолдиқ талаб{' '}
          {numberValue(totals.remainingRequiredTotal ?? 0)} | Баланс{' '}
          {numberValue(totals.balanceAfterCoverage ?? 0)}
        </div>
      )}
    </div>
  );
};
