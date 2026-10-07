import { TypeReference } from 'src/interfaces/reference.interface';
import { Reference } from 'src/references/reference.model';
import { delivererPersonalItem } from './delivererPersonalItem';
import { Entry } from 'src/entries/entry.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const delivererPersonal = async (
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  delivererId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  let result: any = [];
  let filteredData: Reference[] = [];

  if (data && data.length) {
    filteredData = data
      .filter((item: Reference) => item?.typeReference == TypeReference.DELIVERERS)
      .filter((item: Reference) => {
        if (delivererId) {
          return item.dataValues.id == delivererId;
        }
        return true;
      })
      .filter((item: Reference) => {
        if (enterpriseId !== null && enterpriseId !== undefined) {
          return item.enterpriseId === enterpriseId || item.enterpriseId === null;
        }
        return true;
      });
  }

  for (const item of filteredData) {
    const element = await delivererPersonalItem(
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
    reportType: 'DELIVERER_PERSONAL',
    values: [...result],
  };
};
