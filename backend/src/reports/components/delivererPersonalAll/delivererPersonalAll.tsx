import { delivererPersonal } from './delivererPersonal/delivererPersonal';
import { Entry } from 'src/entries/entry.model';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';

export const delivererPersonalAll = async (
  data: any,
  entries: Entry[],
  startDate: number | null,
  endDate: number | null,
  delivererId: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const personalResult = await delivererPersonal(
    data,
    entries,
    startDate,
    endDate,
    delivererId,
    stocksService,
    oborotsService,
    enterpriseId,
  );
  return { ...personalResult };
};
