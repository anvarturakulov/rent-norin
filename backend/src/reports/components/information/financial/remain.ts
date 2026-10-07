import { TypeReference } from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";
import { Reference } from "src/references/reference.model";
import { query } from "src/reports/querys/query";
import { queryKor } from "src/reports/querys/queryKor";
import { StocksService } from "src/stocks/stocks.service";

export const remain = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  typeReference: TypeReference,
  reportId: string,
  typeReport: "POSUM" | "KOSUM",
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const result: { name: string; value: number }[] = [];
  let filteredData: Reference[] = [];

  if (data && data.length > 0) {
    filteredData = data
      .filter((item: Reference) => item?.typeReference == typeReference)
      // Фильтрация по enterpriseId для STORAGES и других справочников
      // TMZ всегда глобальные (enterpriseId = null), фильтрация не нужна
      .filter((item: Reference) => {
        if (enterpriseId !== null && enterpriseId !== undefined) {
          // Для STORAGES фильтруем по enterpriseId
          if (typeReference === TypeReference.STORAGES) {
            return (
              item.enterpriseId === enterpriseId || item.enterpriseId === null
            );
          }
          // Для TMZ не фильтруем (они всегда глобальные)
          if (typeReference === TypeReference.TMZ) {
            return true;
          }
          // Для остальных справочников фильтруем по enterpriseId
          return (
            item.enterpriseId === enterpriseId || item.enterpriseId === null
          );
        }
        // Для глобальных отчетов показываем все
        return true;
      });
  }

  let total = 0;

  const valuePromises = filteredData.map(async (item) => {
    const queryType = typeReport == "POSUM" ? TypeQuery.POSUM : TypeQuery.KOSUM;
    const value = await query(
      Schet.S50,
      queryType,
      startDate,
      endDate,
      item.id,
      null,
      null,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    total += value;
    return value;
  });

  const values = await Promise.all(valuePromises);

  filteredData.forEach((item, index) => {
    const value = values[index];
    if (value) {
      result.push({ name: item.name, value });
    }
  });

  const output = {
    innerReportType: reportId,
    total,
    innerValues: [...result],
  };
  return output;
};
