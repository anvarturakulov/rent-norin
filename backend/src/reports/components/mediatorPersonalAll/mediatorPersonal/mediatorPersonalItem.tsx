import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { query } from "src/reports/querys/query";
import { Reference } from "src/references/reference.model";
import { Entry } from "src/entries/entry.model";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";

const createNameMap = (data: any): Map<number, string> => {
  const nameMap = new Map<number, string>();
  if (data && data.length) {
    data.forEach((item: Reference) => {
      if (item.id != null) nameMap.set(item.id, item.name || "");
    });
  }
  return nameMap;
};

const getName = (nameMap: Map<number, string>, id: number | null): string => {
  if (id == null) return "";
  return nameMap.get(id) || "";
};

export const mediatorPersonalItem = async (
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  mediatorId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const promises = [
    query(
      Schet.S65,
      TypeQuery.POSUM,
      startDate,
      endDate,
      mediatorId,
      null,
      null,
      stocksService,
      oborotsService,
      enterpriseId,
    ),
    query(
      Schet.S65,
      TypeQuery.TDSUM,
      startDate,
      endDate,
      mediatorId,
      null,
      null,
      stocksService,
      oborotsService,
      enterpriseId,
    ),
    query(
      Schet.S65,
      TypeQuery.TKSUM,
      startDate,
      endDate,
      mediatorId,
      null,
      null,
      stocksService,
      oborotsService,
      enterpriseId,
    ),
  ];

  const [POSUM, TDSUM, TKSUM] = await Promise.all(promises);

  if (!POSUM && !TDSUM && !TKSUM) return {};

  const subResults: any[] = [];
  const nameMap = createNameMap(data);

  const filteredList = entries.filter((entry) => {
    const matchesMediator =
      (entry.dataValues.debet == Schet.S65 &&
        entry.dataValues.debetFirstSubcontoId == mediatorId) ||
      (entry.dataValues.kredit == Schet.S65 &&
        entry.dataValues.kreditFirstSubcontoId == mediatorId);
    const matchesDate =
      startDate &&
      endDate &&
      entry.dataValues.date >= startDate &&
      entry.dataValues.date <= endDate;
    return matchesMediator && matchesDate;
  });

  for (const entry of filteredList) {
    const debet = entry.dataValues.debet == Schet.S65;
    const date = entry.dataValues.date;
    const section = debet
      ? getName(nameMap, entry.dataValues?.debetSecondSubcontoId)
      : getName(nameMap, entry.dataValues?.kreditSecondSubcontoId);
    const comment = entry.dataValues?.description;
    const subTDSUM = debet ? entry.dataValues?.total : "";
    const subTKSUM = !debet ? entry.dataValues?.total : "";

    if (subTDSUM || subTKSUM) {
      subResults.push({
        date,
        section,
        comment,
        TDSUM: subTDSUM,
        TKSUM: subTKSUM,
        docId: entry.dataValues.docId,
        documentType: entry.dataValues.documentType,
      });
    }
  }

  return {
    name: getName(nameMap, mediatorId),
    POSUM,
    TDSUM,
    TKSUM,
    subItems: [...subResults],
  };
};
