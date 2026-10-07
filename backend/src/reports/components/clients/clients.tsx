import { TypePartners, TypeReference } from 'src/interfaces/reference.interface';
import { Sequelize } from 'sequelize-typescript';
import { Reference } from 'src/references/reference.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { query } from 'src/reports/querys/query';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';

// Экспортируем интерфейсы
export interface Value {
  count: number;
  summa: number;
}

export interface Client {
  name: string | undefined;
  id: number;
}

export const clients = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  sectionId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {
  let clientsArray: Reference[] = [];

  if (data && data.length) {
    clientsArray = data.filter((item: Reference) => {
      return (
        item?.typeReference == TypeReference.PARTNERS &&
        item?.refValues.typePartners == TypePartners.CLIENTS &&
        item?.refValues.clientForSectionId == sectionId
      );
    })
    // Фильтрация по enterpriseId для отчетов одного предприятия
    .filter((item: Reference) => {
      if (enterpriseId !== null && enterpriseId !== undefined) {
        // Показываем только PARTNERS с enterpriseId === enterpriseId или enterpriseId === null (общие)
        return item.enterpriseId === enterpriseId || item.enterpriseId === null;
      }
      // Для глобальных отчетов показываем все
      return true;
    });
  }

  let days: number[] = [0];
  let day: number = 0;
  if (startDate && endDate) {
    day = startDate;
    while (day <= endDate) {
      days.push(day);
      day += 86400000;
    }
  }

  days.push(0);

  const defaultValue: Value = {
    count: 0,
    summa: 0,
  };

  let chessTable: (Value | Client)[][] = [];

  for (let i = 0; i < days.length - 1; i++) {
    chessTable[i] = [];
    if (i === 0) {
      for (let j = 0; j < clientsArray.length; j++) {
        const clientId = clientsArray[j]?.id || 0;
        const clientName = clientsArray[j]?.name || undefined;
        chessTable[i][j] = { name: clientName, id: clientId };
      }
    } else {
      const promises = clientsArray.map(async (_, j) => {
        const clientId = clientsArray[j]?.id || 0;
        const [count, summa] = await Promise.all([
          query(
            Schet.S40,
            TypeQuery.TDKOL,
            days[i],
            days[i + 1]-1,
            sectionId,
            clientId,
            null,
            stocksService,
            oborotsService,
            enterpriseId
          ),
          query(
            Schet.S40,
            TypeQuery.TDSUM,
            days[i],
            days[i + 1]-1,
            sectionId,
            clientId,
            null,
            stocksService,
            oborotsService,
            enterpriseId
          ),
        ]);
        return { count, summa };
      });
      chessTable[i] = await Promise.all(promises);
    }
  }

  return {
    reportType: 'SKLAD',
    values: [...chessTable],
    dimensions: {
      height: chessTable.length,
      width: chessTable.length > 0 ? chessTable[0].length : 0,
    },
    days: days.slice(1, -1), // Убираем 0 в начале и конце
  };
};