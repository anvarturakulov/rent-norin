'use client';
import styles from './clients.module.css';
import { useEffect } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { ClientProps } from './clients.props';
import { numberValue } from '@/app/service/common/converters';

// Интерфейсы для типизации данных
interface Value {
  count: number;
  summa: number;
}

interface Client {
  name: string | undefined;
  id: number;
}

interface ReportData {
  reportType: string;
  values: (Value | Client)[][];
  dimensions: {
    height: number;
    width: number;
  };
  days: number[];
}

export const Clients = ({ className, ...props }: ClientProps): JSX.Element => {
  const { setMainData, mainData } = useAppContext();
  const { clients } = mainData.report;

  

  // Проверяем, есть ли данные
  if (!clients) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  const reportData: ReportData | undefined = clients;
  if (!reportData) {
    return <div className={styles.noData}>Нет данных с сервера</div>;
  }

  const { values = [], dimensions = { height: 0, width: 0 }, days = [] } = reportData;

  if (!values || !values[0]) {
    return <div className={styles.noData}>Нет клиентов в данных</div>;
  }

  // Форматирование дат для заголовков
  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Получаем список клиентов из первой строки
  const clientsList = values[0].map((item) =>
    'name' in item ? item : { name: '-', id: 0 }
  );

  // Транспонируем данные: строки — клиенты, столбцы — дни
  const clientData = clientsList.map((client, clientIndex) => ({
    client,
    values: (values.slice(1) ?? []).map(
      (row) => (row[clientIndex] as Value) ?? { count: 0, summa: 0 }
    ),
  }));

  // Вычисляем итоги по дням
  const dayTotals = days.map((_, dayIndex) => {
    const totalCount = clientData.reduce((sum, { values }) => sum + (values[dayIndex]?.count || 0), 0);
    const totalSumma = clientData.reduce((sum, { values }) => sum + (values[dayIndex]?.summa || 0), 0);
    return { count: totalCount, summa: totalSumma };
  });

  // Вычисляем общий итог (для последней ячейки)
  const grandTotal = dayTotals.reduce(
    (acc, total) => ({
      count: acc.count + total.count,
      summa: acc.summa + total.summa,
    }),
    { count: 0, summa: 0 }
  );

  return (
    <div className={className}>
      {clientData.length === 0 ? (
        <div className={styles.noData}>Бу цех буйича малумотлар йук</div>
      ) : (
        <div className={styles.sectionContainer}>
          <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>№</th>
                <th>Мижоз</th>
                {days.map((day, index) =>
                  index === days.length - 1 ? (
                    <th key={index} className={styles.totalTh}>
                      Жами
                    </th>
                  ) : (
                    <th key={index} className={styles.th}>
                      {formatDate(day)}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {clientData.map(({ client, values }, clientIndex) => (
                <tr key={clientIndex}>
                  <td>{clientIndex+1}</td>
                  <td>{client.name ?? '-'}</td>
                  {values.map((value, dayIndex) => {
                    if (dayIndex !== values.length - 1) {
                      return (
                        <td key={dayIndex}>
                          {value.count ? (
                            <>
                              <div>{numberValue(value.count)}</div>
                              <div>
                                <span>{numberValue(value.summa)}</span>
                              </div>
                            </>
                          ) : (
                            <div></div>
                          )}
                        </td>
                      );
                    } else {
                      const countTotal = values.reduce((total, item) => total + item?.count, 0);
                      const summaTotal = values.reduce((total, item) => total + item?.summa, 0);
                      return (
                        <td className={styles.totalTd} key={dayIndex}>
                          <div>{numberValue(countTotal)}</div>
                          <div>
                            <span>{numberValue(summaTotal)}</span>
                          </div>
                        </td>
                      );
                    }
                  })}
                </tr>
              ))}
              {/* Строка с итогами по дням */}
              <tr className={styles.totalRow}>
                <td></td>
                <td>Жами</td>
                {dayTotals.map((total, dayIndex) => {
                  if (dayIndex !== days.length - 1) {
                    return (
                      <td key={dayIndex}>
                        {total.count ? (
                          <>
                            <div>{numberValue(total.count)}</div>
                            <div>
                              <span>{numberValue(total.summa)}</span>
                            </div>
                          </>
                        ) : (
                          <div></div>
                        )}
                      </td>
                    );
                  } else {
                    // Последняя ячейка с общим итогом
                    return (
                      <td key={dayIndex} className={styles.totalTd}>
                        {grandTotal.count ? (
                          <>
                            <div>{numberValue(grandTotal.count)}</div>
                            <div>
                              <span>{numberValue(grandTotal.summa)}</span>
                            </div>
                          </>
                        ) : (
                          <div></div>
                        )}
                      </td>
                    );
                  }
                })}
              </tr>
            </tbody>
          </table>

          <div className={styles.dimensions}>
            Жадвал: {clientData.length} мижозлар сони × {days.length - 1} кунга
          </div>
          </div>
        </div>
      )}
    </div>
  );
};