import { Sequelize } from "sequelize-typescript";
import {
  TypePartners,
  TypeReference,
  TypeSECTION,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";
import { Reference } from "src/references/reference.model";
import { query } from "src/reports/querys/query";
import { StocksService } from "src/stocks/stocks.service";
import { ExchangeService } from "src/exchange/exchange.service";
import { DebitorKreditorMode } from "./debitorKreditorMode";

/** TMZ: остаток в stock — first=номенклатура; в oborot/проводках — first=склад, second=номенклатура. */
const TMZ_SCHETS: Schet[] = [Schet.S10, Schet.S28, Schet.S21, Schet.S11, Schet.S29];

const oborotSubcontoForDebet = (
  schet: Schet,
  subcontoId: number,
): { first: number | null; second: number | null } => {
  if (TMZ_SCHETS.includes(schet)) {
    return { first: null, second: subcontoId };
  }
  return { first: subcontoId, second: null };
};

const oborotSubcontoForKredit = (
  schet: Schet,
  subcontoId: number,
): { first: number | null; second: number | null } => {
  if (TMZ_SCHETS.includes(schet)) {
    return { first: null, second: subcontoId };
  }
  return { first: subcontoId, second: null };
};

const turnoverDebit = async (
  schet: Schet,
  startDate: number | null,
  endDate: number | null,
  subcontoId: number,
  stocksService: StocksService,
  oborotsService: OborotsService,
  exchangeService?: ExchangeService,
  isUsdAccount?: boolean,
  enterpriseId?: number | null,
): Promise<number> => {
  const { first, second } = oborotSubcontoForDebet(schet, subcontoId);
  if (isUsdAccount && exchangeService) {
    try {
      const usd = await query(
        schet,
        TypeQuery.TDUSD,
        startDate,
        endDate,
        first,
        second,
        null,
        stocksService,
        oborotsService,
        enterpriseId,
      );
      return await exchangeService.convertUsdToUzs(usd);
    } catch {
      // fallback to UZS turnover
    }
  }
  return query(
    schet,
    TypeQuery.TDSUM,
    startDate,
    endDate,
    first,
    second,
    null,
    stocksService,
    oborotsService,
    enterpriseId,
  );
};

const turnoverKredit = async (
  schet: Schet,
  startDate: number | null,
  endDate: number | null,
  subcontoId: number,
  stocksService: StocksService,
  oborotsService: OborotsService,
  exchangeService?: ExchangeService,
  isUsdAccount?: boolean,
  enterpriseId?: number | null,
): Promise<number> => {
  const { first, second } = oborotSubcontoForKredit(schet, subcontoId);
  if (isUsdAccount && exchangeService) {
    try {
      const usd = await query(
        schet,
        TypeQuery.TKUSD,
        startDate,
        endDate,
        first,
        second,
        null,
        stocksService,
        oborotsService,
        enterpriseId,
      );
      return await exchangeService.convertUsdToUzs(usd);
    } catch {
      // fallback to UZS turnover
    }
  }
  return query(
    schet,
    TypeQuery.TKSUM,
    startDate,
    endDate,
    first,
    second,
    null,
    stocksService,
    oborotsService,
    enterpriseId,
  );
};

const valueDK = async (
  data: any,
  reportId: string,
  type: "start" | "end",
  schet: Schet,
  startDate: number | null,
  endDate: number | null,
  firstSubcontoId: number | null,
  secondSubcontoId: number | null,
  thirdSubcontoId: number,
  stocksService: StocksService,
  oborotsService: OborotsService,
  exchangeService?: ExchangeService,
  isUsdAccount?: boolean,
  enterpriseId?: number | null,
) => {
  // KOSUM: остаток на конец периода — строго после последнего дня (как startDate для начала)
  const closingAsOf =
    endDate != null && endDate !== undefined ? endDate + 1 : endDate;

  // Получаем остатки в сумах
  const [POSUM, KOSUM] = await Promise.all([
    query(
      schet,
      TypeQuery.POSUM,
      startDate,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      stocksService,
      oborotsService,
      enterpriseId,
    ),
    query(
      schet,
      TypeQuery.KOSUM,
      startDate,
      closingAsOf,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      stocksService,
      oborotsService,
      enterpriseId,
    ),
  ]);

  let valueStart = POSUM;
  let valueEnd = KOSUM;

  // Если это валютный счет и есть сервис конвертации, используем только конвертированные суммы
  if (isUsdAccount && exchangeService) {
    try {
      const [POUSD, KOUSD] = await Promise.all([
        query(
          schet,
          TypeQuery.POUSD,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          stocksService,
          oborotsService,
          enterpriseId,
        ),
        query(
          schet,
          TypeQuery.KOUSD,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          stocksService,
          oborotsService,
          enterpriseId,
        ),
      ]);

      // Конвертируем USD в UZS и используем только конвертированные суммы
      const usdToUzsStart = await exchangeService.convertUsdToUzs(POUSD);
      const usdToUzsEnd = await exchangeService.convertUsdToUzs(KOUSD);

      // Заменяем остатки в сумах на конвертированные суммы
      valueStart = usdToUzsStart;
      valueEnd = usdToUzsEnd;
    } catch (error) {
      // В случае ошибки используем только сумы (остаемся с исходными значениями)
    }
  }

  return type === "start" ? valueStart : valueEnd;
};

export const debitorKreditorInners = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  schet: Schet,
  typeReference: TypeReference,
  reportId: string,
  stockService: StocksService,
  oborotsService: OborotsService,
  exchangeService?: ExchangeService,
  isUsdAccount?: boolean,
  enterpriseId?: number | null,
  mode: DebitorKreditorMode = "balances",
) => {
  // console.time(`${reportId}-Total`);

  const innersDebitStart: any[] = [];
  const innersKreditStart: any[] = [];
  const innersDebitEnd: any[] = [];
  const innersKreditEnd: any[] = [];
  const innersDebitOborot: { id: number; name: string; value: number }[] = [];
  const innersKreditOborot: { id: number; name: string; value: number }[] = [];
  let filteredData: Reference[] = [];

  if (data && data.length > 0) {
    filteredData = data
      .filter((item: Reference) => item?.typeReference === typeReference)
      .filter((item: Reference) => {
        // if (reportId === 'DELIVERY') return item?.refValues.typeSection === TypeSECTION.DELIVERY;
        // if (reportId === 'FILIAL') return item?.refValues.typeSection === TypeSECTION.FILIAL;
        if (reportId === "BUXGALTER")
          return (
            item?.refValues?.typeSection === TypeSECTION.CASH ||
            item?.refValues?.typeSection === TypeSECTION.BANK ||
            item?.refValues?.typeSection === TypeSECTION.PLASTIK
          );
        if (reportId === "CLIENTS")
          return item?.refValues?.typePartners === TypePartners.CLIENTS;
        // S41 межпредприятие: субконто — склады (как в aktSverka), в т.ч. чужого enterpriseId
        if (reportId === "DEPARTMENTS") {
          const entId = item?.enterpriseId;
          const name = (item?.name ?? "").trim();
          return (
            entId !== null &&
            entId !== undefined &&
            name.length > 0
          );
        }
        if (reportId === "TOVAR")
          return item?.refValues?.typeTMZ === TypeTMZ.TOVAR;
        if (reportId === "SUPPLIERS")
          return item?.refValues?.typePartners === TypePartners.SUPPLIERS;
        if (reportId === "MEDIATORS")
          return Boolean(
            item?.refValues?.isMediatorDriver ||
              item?.refValues?.isMediatorMaster,
          );
        // if (reportId === 'PRODUCTIONS') return item?.refValues.typeSection === TypeSECTION.COMMON;
        return true;
      })
      // Фильтрация по enterpriseId для локальных справочников (PARTNERS, WORKERS)
      // TMZ всегда глобальные (enterpriseId = null), фильтрация не нужна
      .filter((item: Reference) => {
        if (enterpriseId !== null && enterpriseId !== undefined) {
          // Для STORAGES фильтруем по enterpriseId (кроме S41 / DEPARTMENTS — склады других организаций)
          if (typeReference === TypeReference.STORAGES) {
            if (reportId === "DEPARTMENTS") {
              return true;
            }
            return (
              item.enterpriseId === enterpriseId || item.enterpriseId === null
            );
          }
          // Для TMZ не фильтруем (они всегда глобальные)
          if (typeReference === TypeReference.TMZ) {
            return true;
          }
          // Для остальных локальных справочников (PARTNERS, WORKERS) фильтруем по enterpriseId
          return (
            item.enterpriseId === enterpriseId || item.enterpriseId === null
          );
        }
        // Для глобальных отчетов показываем все
        return true;
      });
  }

  // Получаем ID валютного склада из переменных окружения
  const USD_STORAGE_ID = process.env.USD_STORAGE_ID
    ? Number(process.env.USD_STORAGE_ID)
    : -1;

  const tasks = filteredData.map(async (item) => {
    let firstSubcontoId, secondSubcontoId, thirdSubcontoId;

    firstSubcontoId = item.id;
    secondSubcontoId = null;
    thirdSubcontoId = null;

    // Проверяем, является ли это валютным счетом
    const isUsdAccount = USD_STORAGE_ID === firstSubcontoId;

    let valueStart = 0;
    let valueEnd = 0;
    let debitOborot = 0;
    let kreditOborot = 0;

    if (mode === "oborot") {
      [debitOborot, kreditOborot] = await Promise.all([
        turnoverDebit(
          schet,
          startDate,
          endDate,
          firstSubcontoId,
          stockService,
          oborotsService,
          exchangeService,
          isUsdAccount,
          enterpriseId,
        ),
        turnoverKredit(
          schet,
          startDate,
          endDate,
          firstSubcontoId,
          stockService,
          oborotsService,
          exchangeService,
          isUsdAccount,
          enterpriseId,
        ),
      ]);
    } else {
      [valueStart, valueEnd] = await Promise.all([
        valueDK(
          data,
          reportId,
          "start",
          schet,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          stockService,
          oborotsService,
          exchangeService,
          isUsdAccount,
          enterpriseId,
        ),
        valueDK(
          data,
          reportId,
          "end",
          schet,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          stockService,
          oborotsService,
          exchangeService,
          isUsdAccount,
          enterpriseId,
        ),
      ]);
    }

    return { item, valueStart, valueEnd, debitOborot, kreditOborot };
  });

  const results = await Promise.all(tasks);

  for (const { item, valueStart, valueEnd, debitOborot, kreditOborot } of results) {
    if (mode !== "oborot") {
      const elementStart = { id: item.id, name: item.name, value: valueStart };
      const elementEnd = { id: item.id, name: item.name, value: valueEnd };

      if (valueStart > 0) innersDebitStart.push(elementStart);
      if (valueStart < 0) {
        elementStart.value = elementStart.value * -1;
        innersKreditStart.push(elementStart);
      }
      if (valueEnd > 0) innersDebitEnd.push(elementEnd);
      if (valueEnd < 0) {
        elementEnd.value = elementEnd.value * -1;
        innersKreditEnd.push(elementEnd);
      }
    }

    if (mode !== "balances") {
      if (debitOborot > 0) {
        innersDebitOborot.push({
          id: item.id,
          name: item.name,
          value: debitOborot,
        });
      }
      if (kreditOborot > 0) {
        innersKreditOborot.push({
          id: item.id,
          name: item.name,
          value: kreditOborot,
        });
      }
    }
  }

  if (mode === "oborot") {
    return {
      innerReportType: reportId,
      schet,
      totalDebitOborot: innersDebitOborot.reduce(
        (acc, item) => acc + item.value,
        0,
      ),
      totalKreditOborot: innersKreditOborot.reduce(
        (acc, item) => acc + item.value,
        0,
      ),
      innersDebitOborot: [...innersDebitOborot],
      innersKreditOborot: [...innersKreditOborot],
    };
  }

  const output = {
    innerReportType: reportId,
    schet,
    totalDebitOborot: innersDebitOborot.reduce((acc, item) => acc + item.value, 0),
    totalKreditOborot: innersKreditOborot.reduce((acc, item) => acc + item.value, 0),
    innersDebitOborot: [...innersDebitOborot],
    innersKreditOborot: [...innersKreditOborot],
    totalDebitStart: innersDebitStart.reduce(
      (acc, item: any) => acc + item?.value,
      0,
    ),
    totalKreditStart: innersKreditStart.reduce(
      (acc, item: any) => acc + item?.value,
      0,
    ),
    innersDebitStart: [...innersDebitStart],
    innersKreditStart: [...innersKreditStart],
    totalDebitEnd: innersDebitEnd.reduce(
      (acc, item: any) => acc + item?.value,
      0,
    ),
    totalKreditEnd: innersKreditEnd.reduce(
      (acc, item: any) => acc + item?.value,
      0,
    ),
    innersDebitEnd: [...innersDebitEnd],
    innersKreditEnd: [...innersKreditEnd],
  };

  // console.timeEnd(`${reportId}-Total`);
  return output;
};
