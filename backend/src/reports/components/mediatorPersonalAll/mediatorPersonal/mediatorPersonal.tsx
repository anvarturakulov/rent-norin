import { TypeReference } from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { mediatorPersonalItem } from "./mediatorPersonalItem";
import { Entry } from "src/entries/entry.model";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { partnerHasMediatorRole } from "src/documents/helper/mediatorBonus.helper";

export const mediatorPersonal = async (
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  mediatorId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const result: any[] = [];
  let filteredData: Reference[] = [];

  if (data && data.length) {
    filteredData = data
      .filter((item: Reference) => item?.typeReference == TypeReference.PARTNERS)
      .filter((item: Reference) => partnerHasMediatorRole(item?.refValues))
      .filter((item: Reference) => {
        if (mediatorId) {
          return item.dataValues.id == mediatorId;
        }
        return true;
      })
      .filter((item: Reference) => {
        if (enterpriseId !== null && enterpriseId !== undefined) {
          return (
            item.enterpriseId === enterpriseId || item.enterpriseId === null
          );
        }
        return true;
      });
  }

  for (const item of filteredData) {
    const element = await mediatorPersonalItem(
      data,
      entries,
      startDate,
      endDate,
      item.id,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    if (Object.keys(element).length > 0) {
      result.push(element);
    }
  }
  return {
    reportType: "MEDIATOR_PERSONAL",
    values: [...result],
  };
};
