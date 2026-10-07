import { TypeReference } from 'src/interfaces/reference.interface';
import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { OborotsService } from 'src/oborots/oborots.service';
import { Reference } from 'src/references/reference.model';
import { query } from 'src/reports/querys/query';
import { StocksService } from 'src/stocks/stocks.service';

const MAT_OBOROT_SCHET_CONFIG: Partial<
  Record<Schet, { accountType: string; accountNumber: number }>
> = {
  [Schet.S10]: { accountType: 'MATERIAL', accountNumber: 10 },
  [Schet.S21]: { accountType: 'HALFSTUFF', accountNumber: 21 },
  [Schet.S28]: { accountType: 'PRODUCT', accountNumber: 28 },
  [Schet.S11]: { accountType: 'TOOLS', accountNumber: 11 },
  [Schet.S29]: { accountType: 'TOVAR', accountNumber: 29 },
  [Schet.S12]: { accountType: 'TOOLS_AT_CLIENT', accountNumber: 12 },
};

export const isMatOborotSchet = (schet: Schet | null | undefined): schet is Schet =>
  schet != null && schet in MAT_OBOROT_SCHET_CONFIG;

const prepareResult = async (
  data: any[],
  startDate,
  endDate,
  currentSectionId,
  schet: Schet,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
  tmzId?: number | null,
) => {
  const result: any[] = [];
  const idToRefName = new Map<number, string>();
  const tmzById = new Map<number, Reference>();

  if (data && data.length) {
    for (const r of data as Reference[]) {
      if (r?.id != null) {
        idToRefName.set(r.id, (r.name ?? '').trim());
        if (r?.typeReference === TypeReference.TMZ) {
          tmzById.set(r.id, r);
        }
      }
    }
  }

  let filteredData: Reference[] = [];

  if (tmzId != null) {
    const one = tmzById.get(tmzId);
    filteredData = one ? [one] : [];
  } else if (currentSectionId) {
    const [movementIds, stockIds] = await Promise.all([
      oborotsService.getSecondSubcontoIdsWithMovementForSchet(
        schet,
        currentSectionId,
        startDate,
        endDate,
        enterpriseId,
      ),
      stocksService.getSecondSubcontoIdsWithStockForSchet(
        schet,
        currentSectionId,
        enterpriseId,
      ),
    ]);
    const candidateIds = new Set(
      [...movementIds, ...stockIds].filter((id) => id > 0),
    );
    filteredData = [...candidateIds]
      .map((id) => tmzById.get(id))
      .filter((item): item is Reference => item != null);
  }

  for (const item of filteredData) {
    const promises = [
      query(schet, TypeQuery.POKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      query(schet, TypeQuery.POSUM, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      query(schet, TypeQuery.TDKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      query(schet, TypeQuery.TDSUM, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      query(schet, TypeQuery.TKKOL, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
      query(schet, TypeQuery.TKSUM, startDate, endDate, currentSectionId, item.id, null, stocksService, oborotsService, enterpriseId),
    ];

    const [POKOL, POSUM, TDKOL, TDSUM, TKKOL, TKSUM] = await Promise.all(promises);

    if (POKOL || POSUM || TDKOL || TDSUM || TKKOL || TKSUM) {
      const rv = item.refValues;
      const pid = (item as any)?.parentId ?? null;
      const parentName =
        pid != null && typeof pid === 'number' ? idToRefName.get(pid) ?? '' : '';
      const element = {
        id: item.id,
        parentId: pid,
        parentName: parentName || null,
        isFolder: (item as any)?.isFolder ?? false,
        name: item.name,
        article: item.article ?? '',
        imagePath: rv?.imagePath ?? null,
        imagePath2: rv?.imagePath2 ?? null,
        imagePath3: rv?.imagePath3 ?? null,
        unit: (item as any)?.refValues?.unit || '',
        POKOL,
        POSUM,
        TDKOL,
        TDSUM,
        TKKOL,
        TKSUM,
      };

      if (Object.keys(element).length) {
        result.push(element);
      }
    }
  }

  return result;
};

export const skladItem = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number | null,
  title: string,
  stocksService: StocksService,
  oborotsService: OborotsService,
  schet: Schet,
  enterpriseId?: number | null,
  tmzId?: number | null,
) => {
  const config = MAT_OBOROT_SCHET_CONFIG[schet];
  if (!config) {
    return [];
  }

  const items = await prepareResult(
    data,
    startDate,
    endDate,
    currentSectionId,
    schet,
    stocksService,
    oborotsService,
    enterpriseId,
    tmzId,
  );

  return [
    {
      section: `${title}`,
      sectionId: currentSectionId,
      accountType: config.accountType,
      accountNumber: config.accountNumber,
      items: items || [],
    },
  ];
};
