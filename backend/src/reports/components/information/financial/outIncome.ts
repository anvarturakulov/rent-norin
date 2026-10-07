import { TypeReference } from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";
import { Reference } from "src/references/reference.model";
import { queryKor } from "src/reports/querys/queryKor";

export const outIncome = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  debetSchet: Schet,
  kreditSchet: Schet,
  typeReference: TypeReference,
  reportId: string,
  typeReport: "income" | "out",
  bySecondSubconto: boolean,
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
          // Для остальных справочников (WORKERS, PARTNERS, CHARGES) фильтруем по enterpriseId
          return (
            item.enterpriseId === enterpriseId || item.enterpriseId === null
          );
        }
        // Для глобальных отчетов показываем все
        return true;
      });
  }

  // Собираем все запросы параллельно
  const totalPromise =
    typeReport == "out"
      ? queryKor(
          debetSchet,
          kreditSchet,
          TypeQuery.OKS,
          startDate,
          endDate,
          null,
          null,
          null,
          oborotsService,
          enterpriseId,
        )
      : queryKor(
          debetSchet,
          kreditSchet,
          TypeQuery.ODS,
          startDate,
          endDate,
          null,
          null,
          null,
          oborotsService,
          enterpriseId,
        );

  const valuePromises = filteredData.map((item) => {
    const queryType = typeReport == "out" ? TypeQuery.ODS : TypeQuery.OKS;
    return queryKor(
      debetSchet,
      kreditSchet,
      queryType,
      startDate,
      endDate,
      bySecondSubconto ? null : item.id,
      bySecondSubconto ? item.id : null,
      null,
      oborotsService,
      enterpriseId,
    );
  });

  const [total, ...values] = await Promise.all([
    totalPromise,
    ...valuePromises,
  ]);

  // Формируем result
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
