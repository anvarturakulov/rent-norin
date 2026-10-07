import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { Sequelize } from 'sequelize-typescript';
import { query } from 'src/reports/querys/query';
import { Reference } from 'src/references/reference.model';
import { Entry } from 'src/entries/entry.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

// Оптимизируем getName с использованием Map для быстрого поиска
const createNameMap = (data: any): Map<number, string> => {
  const nameMap = new Map<number, string>();
  if (data && data.length) {
    data.forEach((item: Reference) => {
      if (item.id != null) nameMap.set(item.id, item.name || '');
    });
  }
  return nameMap;
};

const getName = (nameMap: Map<number, string>, id: number | null): string => {
  if (id == null) return '';
  return nameMap.get(id) || '';
};

export const personalItem = async ( 
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  workerId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null
) => {    
  const promises = [
    query(Schet.S67, TypeQuery.POSUM, startDate, endDate, workerId, null, null, stocksService, oborotsService, enterpriseId),
    query(Schet.S67, TypeQuery.TDSUM, startDate, endDate, workerId, null, null, stocksService, oborotsService, enterpriseId),
    query(Schet.S67, TypeQuery.TKSUM, startDate, endDate, workerId, null, null, stocksService, oborotsService, enterpriseId),
  ];

  const [POSUM, TDSUM, TKSUM] = await Promise.all(promises);

  if (!POSUM && !TDSUM && !TKSUM) return {};

  let subResults: any[] = [];
  const nameMap = createNameMap(data); // Создаём Map один раз для быстрого доступа

  // Объединяем два фильтра в один
  let filteredList = entries.filter(entry => {
    const matchesWorker =
      (entry.dataValues.debet == Schet.S67 && entry.dataValues.debetFirstSubcontoId == workerId) ||
      (entry.dataValues.kredit == Schet.S67 && entry.dataValues.kreditFirstSubcontoId == workerId);
    const matchesDate = startDate && endDate && entry.dataValues.date >= startDate && entry.dataValues.date <= endDate;
    return matchesWorker && matchesDate;
  });

  if (filteredList && filteredList.length) {
    for (const entry of filteredList) {
      const debet = entry.dataValues.debet == Schet.S67;
      const date = entry.dataValues.date;
      const section = debet ? getName(nameMap, entry.dataValues?.debetSecondSubcontoId) : getName(nameMap, entry.dataValues?.kreditSecondSubcontoId);
      const comment = entry.dataValues?.description;
      const subTDSUM = debet ? entry.dataValues?.total : '';
      const subTKSUM = !debet ? entry.dataValues?.total : '';
      
      if (subTDSUM || subTKSUM) {
        let subElement = {
          date,
          section,
          comment,
          TDSUM: subTDSUM,
          TKSUM: subTKSUM,
          docId: entry.dataValues.docId,
          documentType: entry.dataValues.documentType,
        };
        subResults.push(subElement);
      }
    }
  }
  
  let element = {
    name: getName(nameMap, workerId),
    POSUM,
    TDSUM,
    TKSUM,
    subItems: [...subResults]
  };
  
  return element;
};