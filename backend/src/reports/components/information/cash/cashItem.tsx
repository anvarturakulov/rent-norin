import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { query } from 'src/reports/querys/query';
import { queryKor } from 'src/reports/querys/queryKor';
import { StocksService } from 'src/stocks/stocks.service';
import { OborotsService } from 'src/oborots/oborots.service';
import { ReferencesService } from 'src/references/references.service';
import { ExchangeService } from 'src/exchange/exchange.service';

export const cashItem = async (
  startDate: number | null,
  endDate: number | null,
  currentSectionId: number | null,
  title: string,
  stocksService: StocksService,
  oborotsService: OborotsService,
  referencesService: ReferencesService,
  enterpriseId?: number | null,
  exchangeService?: ExchangeService
) => {
  const USD_STORAGE_ID = process.env.USD_STORAGE_ID ? Number(process.env.USD_STORAGE_ID) : -1;

  // Как debitorKreditorInners: конвертация остатков только для счёта из USD_STORAGE_ID
  const isUsdBalanceConvert =
    currentSectionId !== null && USD_STORAGE_ID === currentSectionId;

  // Для оборотов (ODU/OKU) — тот же счёт или isForeign, без смены правил конвертации остатков
  let useForeignCurrencyKor = isUsdBalanceConvert;
  if (!useForeignCurrencyKor && currentSectionId !== null) {
    try {
      const reference = await referencesService.getReferenceById(currentSectionId);
      if (reference?.refValues?.isForeign === true) {
        useForeignCurrencyKor = true;
      }
    } catch (error) {
      console.error(`Ошибка при получении справочника ${currentSectionId}:`, error);
    }
  }

  const balancePromises: Promise<number>[] = [];

  if (!isUsdBalanceConvert) {
    balancePromises.push(
      query(Schet.S50, TypeQuery.POSUM, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S50, TypeQuery.KOSUM, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId)
    );
  } else if (exchangeService) {
    balancePromises.push(
      query(Schet.S50, TypeQuery.POSUM, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S50, TypeQuery.KOSUM, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S50, TypeQuery.POUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S50, TypeQuery.KOUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId)
    );
  } else {
    balancePromises.push(
      query(Schet.S50, TypeQuery.POUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId),
      query(Schet.S50, TypeQuery.KOUSD, startDate, endDate, currentSectionId, null, null, stocksService, oborotsService, enterpriseId)
    );
  }

  const korPromises = [
    queryKor(Schet.S50, Schet.S40, !useForeignCurrencyKor ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S50, Schet.S41, !useForeignCurrencyKor ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S50, Schet.S50, !useForeignCurrencyKor ? TypeQuery.ODS : TypeQuery.ODU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S50, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S20, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S67, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S41, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S60, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
    queryKor(Schet.S66, Schet.S50, !useForeignCurrencyKor ? TypeQuery.OKS : TypeQuery.OKU, startDate, endDate, currentSectionId, null, null, oborotsService, enterpriseId),
  ];

  const allResults = await Promise.all([...balancePromises, ...korPromises]);

  let POSUM: number;
  let KOSUM: number;

  if (!isUsdBalanceConvert) {
    POSUM = allResults[0];
    KOSUM = allResults[1];
  } else if (exchangeService) {
    const sumStart = allResults[0];
    const sumEnd = allResults[1];
    const usdStart = allResults[2];
    const usdEnd = allResults[3];
    try {
      POSUM = await exchangeService.convertUsdToUzs(usdStart);
      KOSUM = await exchangeService.convertUsdToUzs(usdEnd);
    } catch {
      POSUM = sumStart;
      KOSUM = sumEnd;
    }
  } else {
    POSUM = allResults[0];
    KOSUM = allResults[1];
  }

  const korOffset = balancePromises.length;
  const INCOME40 = allResults[korOffset];
  const INCOME41 = allResults[korOffset + 1];
  const MOVEINCOME = allResults[korOffset + 2];
  const MOVEOUT = allResults[korOffset + 3];
  const OUTFORCHARGES20 = allResults[korOffset + 4];
  const OUTFORCHARGES67 = allResults[korOffset + 5];
  const OUTFORDEPARTMENTS = allResults[korOffset + 6];
  const OUTFORSUPPLIERS = allResults[korOffset + 7];
  const OUTFORFOUNDER = allResults[korOffset + 8];

  const CHARGES = OUTFORCHARGES20 + OUTFORCHARGES67;

  if (!(POSUM) && !(INCOME40 + MOVEINCOME) && !(CHARGES + OUTFORDEPARTMENTS + MOVEOUT + OUTFORFOUNDER) && !(KOSUM)) return {};
  return {
    section: title,
    startBalans: POSUM,
    incomeFromClients: INCOME40,
    incomeFromDepartments: INCOME41,
    moveIncome: MOVEINCOME,
    moveOut: MOVEOUT,
    outForCharges: CHARGES,
    outForSuppliers: OUTFORSUPPLIERS,
    outForDepartments: OUTFORDEPARTMENTS,
    outForFounder: OUTFORFOUNDER,
    allIncome: INCOME40 + MOVEINCOME + INCOME41,
    allOut: CHARGES + OUTFORSUPPLIERS + OUTFORDEPARTMENTS + MOVEOUT + OUTFORFOUNDER,
    endBalans: KOSUM,
  };
};
