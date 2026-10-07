import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import { Op } from "sequelize";
import { Entry } from "src/entries/entry.model";
import {
  DEBETKREDIT,
  QueryOperationsBySchet,
  QuerySimple,
  QueryWorker,
  Schet,
  TypeQuery,
} from "src/interfaces/report.interface";
import { query } from "./querys/query";
import { information } from "./components/information/information";
import { matOborot } from "./components/matOborot/matOborot";
import { osOborot } from "./components/osOborot/osOborot";
import { ReferencesService } from "src/references/references.service";
import { oborotkaAll } from "./components/oborotkaAll/oborotkaAll";
import { EntriesService } from "src/entries/entries.service";
import { personalAll } from "./components/personalAll/personalAll";
import { mediatorPersonalAll } from "./components/mediatorPersonalAll/mediatorPersonalAll";
import { delivererPersonalAll } from "./components/delivererPersonalAll/delivererPersonalAll";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocumentsService } from "src/documents/documents.service";
import { DocumentType } from "src/interfaces/document.interface";
import { clients } from "./components/clients/clients";
import { TypePartners, TypeTMZ } from "src/interfaces/reference.interface";
import { ExchangeService } from "src/exchange/exchange.service";
import { aktSverka } from "./components/aktSverka/aktSverka";
import { supplierGoods } from "./components/supplierGoods/supplierGoods";
import { rentalExpectedIncome } from "./components/rentalExpectedIncome/rentalExpectedIncome";
import { subleaseExpectedIncome } from "./components/subleaseExpectedIncome/subleaseExpectedIncome";
import { rentalNetProfit } from "./components/rentalNetProfit/rentalNetProfit";
import { ProductCalculationsService } from "src/productCalculations/productCalculations.service";
import { EnterprisesService } from "src/enterprises/enterprises.service";
import { getIncomeDetails } from "./components/information/foydaByProduction/getIncomeDetails";
import { getToolsAtClientDetails } from "./components/information/toolsCurrentBalance/getAtClientDetails";
import { debitorKreditor } from "./components/information/debitorKreditor/debitorKreditor";
import { ClientToolBatchesService } from "src/clientToolBatches/clientToolBatches.service";
import { SubleaseToolBatchesService } from "src/subleaseToolBatches/subleaseToolBatches.service";
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Entry) private entryRepository: typeof Entry,
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Document) private documentRepository: typeof Document,
    @Inject(forwardRef(() => ReferencesService))
    private referencesService: ReferencesService,
    private entriesService: EntriesService,
    private stocksService: StocksService,
    private oborotsService: OborotsService,
    @Inject(forwardRef(() => DocumentsService))
    private documentsService: DocumentsService,
    private exchangeService: ExchangeService,
    private productCalculationsService: ProductCalculationsService,
    private enterprisesService: EnterprisesService,
    private configService: ConfigService,
    private clientToolBatchesService: ClientToolBatchesService,
    private subleaseToolBatchesService: SubleaseToolBatchesService,
  ) {}

  async getAllDocumentsByType(documentType) {
    // const documents = await this.documentsService.getAllDocumentsByType(documentType)
    // return documents;
    const documents = await this.documentRepository.findAll({
      where: { documentType },
      include: [DocValues, DocTableItems],
    });
    return documents;
  }

  async getQueryValue(req: QuerySimple) {
    const {
      typeQuery,
      schet,
      startDate,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      enterpriseId,
    } = req;
    return await query(
      schet,
      typeQuery,
      startDate,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
  }

  async getPriceAndBalance(queryReport: QuerySimple) {
    const {
      schet,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      enterpriseId,
    } = queryReport;

    if (
      schet &&
      firstSubcontoId &&
      (secondSubcontoId === null || secondSubcontoId === undefined)
    ) {
      if (schet === Schet.S40) {
        const balance = await query(
          schet,
          TypeQuery.KOSUM,
          endDate,
          endDate,
          firstSubcontoId,
          null,
          thirdSubcontoId,
          this.stocksService,
          this.oborotsService,
          enterpriseId,
        );
        return { price: 0, balance };
      }

      if (schet === Schet.S12) {
        const toolIds =
          await this.oborotsService.getSecondSubcontoIdsWithMovementForSchet(
            Schet.S12,
            firstSubcontoId,
            null,
            endDate,
            enterpriseId,
          );

        const balances = await Promise.all(
          toolIds
            .filter((id) => id > 0)
            .map((toolId) =>
              query(
                Schet.S12,
                TypeQuery.KOSUM,
                endDate,
                endDate,
                firstSubcontoId,
                toolId,
                null,
                this.stocksService,
                this.oborotsService,
                enterpriseId,
              ),
            ),
        );

        return {
          price: 0,
          balance: balances.reduce((sum, value) => sum + value, 0),
        };
      }
    }

    // let countCome = await query(schet, TypeQuery.COUNTCOME, 0, endDate, firstSubcontoId, secondSubcontoId, thirdSubcontoId, this.stocksService, this.oborotsService, enterpriseId)
    // let countLeave = await query(schet, TypeQuery.COUNTLEAVE, 0, endDate, firstSubcontoId, secondSubcontoId, thirdSubcontoId, this.stocksService, this.oborotsService, enterpriseId)
    // let totalCome = await query(schet, TypeQuery.TOTALCOME, 0, endDate, firstSubcontoId, secondSubcontoId, thirdSubcontoId, this.stocksService, this.oborotsService, enterpriseId)
    // let totalLeave = await query(schet, TypeQuery.TOTALLEAVE, 0, endDate, firstSubcontoId, secondSubcontoId, thirdSubcontoId, this.stocksService, this.oborotsService, enterpriseId)

    // let totalCount = countCome - countLeave;
    // let totalSumma = totalCome - totalLeave;

    const totalCount = await query(
      schet,
      TypeQuery.POKOL,
      endDate,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
    const totalSumma = await query(
      schet,
      TypeQuery.POSUM,
      endDate,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );

    // Логирование для диагностики завышенной себестоимости
    const calculatedPrice = totalCount
      ? +(totalSumma / totalCount).toFixed(5)
      : 0;

    this.logger.log(`💰 [getPriceAndBalance] Расчет себестоимости:`, {
      schet,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      firstSubcontoId,
      secondSubcontoId,
      enterpriseId,
      totalCount,
      totalSumma,
      calculatedPrice,
      расчет:
        totalCount > 0
          ? `${totalSumma} / ${totalCount} = ${calculatedPrice}`
          : "деление на 0",
    });

    return {
      price: calculatedPrice,
      balance: totalCount,
    };
  }

  async getInformation(queryInformation: QuerySimple) {
    const {
      startDate,
      endDate,
      reportType,
      enterpriseId,
      reportYear,
      firstSubcontoId,
    } = queryInformation;

    this.logger.debug(
      `[getInformation] reportType=${reportType} startDate=${startDate} endDate=${endDate} reportYear=${reportYear} enterpriseId=${enterpriseId} firstSubcontoId=${firstSubcontoId}`,
    );

    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    const singleEnterpriseMode =
      this.configService.get("SINGLE_ENTERPRISE_MODE") === "true";

    // console.time('Information');
    const inform = await information(
      references,
      startDate,
      endDate,
      reportType,
      [],
      this.sequelize,
      this.stocksService,
      this.oborotsService,
      this.documentsService,
      this.entriesService,
      this.exchangeService,
      this.referencesService,
      this.productCalculationsService,
      this.enterprisesService,
      enterpriseId,
      reportYear,
      singleEnterpriseMode,
      firstSubcontoId,
    );
    // console.timeEnd('Information');
    return inform;
  }

  async getDebitorKreditorOborot(queryOborot: QuerySimple) {
    const { startDate, endDate, enterpriseId } = queryOborot;
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);
    const values = await debitorKreditor(
      references,
      startDate,
      endDate,
      this.stocksService,
      this.oborotsService,
      this.exchangeService,
      enterpriseId,
      "oborot",
    );
    return {
      reportType: "DEBITORKREDITOR",
      values,
    };
  }

  async getMatOtchet(queryMatOtchet: QuerySimple) {
    const { startDate, endDate, sectionId, tmzId, enterpriseId, schet } =
      queryMatOtchet;

    const matOborotSchets = [
      Schet.S10,
      Schet.S21,
      Schet.S28,
      Schet.S11,
      Schet.S29,
      Schet.S12,
    ];
    if (!schet || !matOborotSchets.includes(schet)) {
      throw new BadRequestException(
        "schet is required for matOborot (S10, S21, S28, S11, S29, S12)",
      );
    }

    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    return await matOborot(
      references,
      startDate,
      endDate,
      sectionId,
      this.stocksService,
      this.oborotsService,
      schet,
      enterpriseId,
      tmzId,
    );
  }

  async getOsOborot(queryOsOborot: QuerySimple) {
    const { startDate, endDate, sectionId, enterpriseId } = queryOsOborot;
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);
    return osOborot(
      references,
      startDate,
      endDate,
      sectionId ?? null,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
  }

  async getPersonal(queryOborotka: QuerySimple) {
    const { startDate, endDate, firstSubcontoId, enterpriseId } = queryOborotka;

    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    const entrys = await this.entriesService.getAllEntries(enterpriseId);
    const result = personalAll(
      references,
      entrys,
      startDate,
      endDate,
      firstSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
    return result;
  }

  async getMediatorPersonal(queryOborotka: QuerySimple) {
    const { startDate, endDate, firstSubcontoId, enterpriseId } = queryOborotka;
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);
    const entrys = await this.entriesService.getAllEntries(enterpriseId);
    return mediatorPersonalAll(
      references,
      entrys,
      startDate,
      endDate,
      firstSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
  }

  async getDelivererPersonal(queryOborotka: QuerySimple) {
    const { startDate, endDate, firstSubcontoId, enterpriseId } = queryOborotka;
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);
    const entrys = await this.entriesService.getAllEntries(enterpriseId);
    return delivererPersonalAll(
      references,
      entrys,
      startDate,
      endDate,
      firstSubcontoId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
  }

  async getOborotka(queryOborotka: QuerySimple) {
    const { startDate, endDate, schet, enterpriseId } = queryOborotka;

    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    const entrys = await this.entriesService.getAllEntries(enterpriseId);
    const result = oborotkaAll(
      references,
      entrys,
      startDate,
      endDate,
      schet,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
    return result;
  }

  async getAnalitic(queryAnalitic: QuerySimple) {
    const {
      startDate,
      endDate,
      schet,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      dk,
      enterpriseId,
    } = queryAnalitic;

    if (!startDate || !endDate || !schet) {
      return [];
    }

    const subId = (value: unknown): number => Number(value);
    const schetKey = String(schet);
    const secondSubcontoDrillSchets = new Set(
      [Schet.S10, Schet.S28, Schet.S21, Schet.S01, Schet.S02].map(String),
    );
    const matchBySecondSubcontoOnly =
      secondSubcontoDrillSchets.has(schetKey) &&
      (firstSubcontoId === null ||
        firstSubcontoId === undefined ||
        subId(firstSubcontoId) === 0) &&
      secondSubcontoId !== null &&
      secondSubcontoId !== undefined &&
      subId(secondSubcontoId) > 0;

    const matchesSubcontoId = (
      entryValue: unknown,
      queryValue: unknown,
    ): boolean => subId(entryValue) === subId(queryValue);

    const entrys = await this.entriesService.getAllEntries(enterpriseId);
    const filtered = entrys
      .filter((entry: Entry) => {
        const date = subId(entry.dataValues.date);
        return date >= subId(startDate) && date <= subId(endDate);
      })
      .filter((entry: Entry) => {
        const isDebet = dk === DEBETKREDIT.DEBET || String(dk) === "DEBET";
        const row = entry.dataValues;

        if (isDebet) {
          if (String(row.debet) !== schetKey) return false;
          if (matchBySecondSubcontoOnly) {
            return matchesSubcontoId(
              row.debetSecondSubcontoId,
              secondSubcontoId,
            );
          }
          if (
            firstSubcontoId !== null &&
            firstSubcontoId !== undefined &&
            !matchesSubcontoId(row.debetFirstSubcontoId, firstSubcontoId)
          ) {
            return false;
          }
          if (
            secondSubcontoId !== null &&
            secondSubcontoId !== undefined &&
            !matchesSubcontoId(row.debetSecondSubcontoId, secondSubcontoId)
          ) {
            return false;
          }
          if (
            thirdSubcontoId !== null &&
            thirdSubcontoId !== undefined &&
            !matchesSubcontoId(row.debetThirdSubcontoId, thirdSubcontoId)
          ) {
            return false;
          }
          return true;
        }

        if (String(row.kredit) !== schetKey) return false;
        if (matchBySecondSubcontoOnly) {
          return matchesSubcontoId(row.kreditSecondSubcontoId, secondSubcontoId);
        }
        if (
          firstSubcontoId !== null &&
          firstSubcontoId !== undefined &&
          !matchesSubcontoId(row.kreditFirstSubcontoId, firstSubcontoId)
        ) {
          return false;
        }
        if (
          secondSubcontoId !== null &&
          secondSubcontoId !== undefined &&
          !matchesSubcontoId(row.kreditSecondSubcontoId, secondSubcontoId)
        ) {
          return false;
        }
        if (
          thirdSubcontoId !== null &&
          thirdSubcontoId !== undefined &&
          !matchesSubcontoId(row.kreditThirdSubcontoId, thirdSubcontoId)
        ) {
          return false;
        }
        return true;
      });

    return filtered.map((entry: Entry) => {
      const row = entry.dataValues ?? entry;
      return {
        date: subId(row.date),
        docNumber: subId(row.docId),
        docId: String(row.docId ?? ""),
        documentType: row.documentType,
        debet: row.debet,
        debetFirstSubcontoId: String(row.debetFirstSubcontoId ?? ""),
        debetSecondSubcontoId: String(row.debetSecondSubcontoId ?? ""),
        kredit: row.kredit,
        kreditFirstSubcontoId: String(row.kreditFirstSubcontoId ?? ""),
        kreditSecondSubcontoId: String(row.kreditSecondSubcontoId ?? ""),
        count: Number(row.count) || 0,
        total: Number(row.total) || 0,
        description: row.description ?? "",
        fullDescription: row.fullDescription ?? "",
      };
    });
  }

  async getApartmentsPaymentDetails(
    clientId: number,
    monthKey: string,
    enterpriseId?: number | null,
  ) {
    // Парсим месяц из формата "YYYY-MM"
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = Date.UTC(year, month, 0, 23, 59, 59, 999);

    // Получаем все проводки
    const allEntries = await this.entriesService.getAllEntries(
      enterpriseId ?? undefined,
    );

    // Фильтруем проводки для ComeCashFromClients за указанный месяц
    const paymentEntries = allEntries.filter((entry: Entry) => {
      const entryDate = Number(entry.date);
      const isInMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const isComeCashFromClients =
        entry.documentType === DocumentType.ComeCashFromClients;
      const isCorrectDebet =
        entry.debet === Schet.S50 || entry.debet === Schet.S00;
      const isCorrectKredit = entry.kredit === Schet.S40;
      const isClientMatch =
        entry.debetSecondSubcontoId === clientId ||
        entry.kreditFirstSubcontoId === clientId;

      return (
        isInMonth &&
        isComeCashFromClients &&
        isCorrectDebet &&
        isCorrectKredit &&
        isClientMatch
      );
    });

    // Получаем документы для этих проводок
    const docIds = [
      ...new Set(paymentEntries.map((e: Entry) => Number(e.docId))),
    ];
    const documents = await this.documentRepository.findAll({
      where: { id: docIds },
      include: [DocValues],
    });

    // Формируем результат с детализацией
    const details = paymentEntries.map((entry: Entry) => {
      const doc = documents.find(
        (d: Document) => Number(d.id) === Number(entry.docId),
      );
      return {
        docId: entry.docId,
        date: entry.date,
        total: entry.total,
        documentType: entry.documentType,
        documentDate: doc?.date,
        documentNumber: doc?.id,
        comment: doc?.docValues?.comment || "",
      };
    });

    return details;
  }

  async getClientTotalPaidDetails(
    clientId: number,
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    // Получаем все проводки
    const allEntries = await this.entriesService.getAllEntries(
      enterpriseId ?? undefined,
    );

    // Фильтруем проводки для оплат клиента за указанный период
    const paymentEntries = allEntries.filter((entry: Entry) => {
      const entryDate = Number(entry.date);
      const isInPeriod = entryDate >= startDate && entryDate <= endDate;
      const isCorrectDebet =
        entry.debet === Schet.S50 || entry.debet === Schet.S00;
      const isCorrectKredit = entry.kredit === Schet.S40;
      const isClientMatch =
        entry.debetSecondSubcontoId === clientId ||
        entry.kreditFirstSubcontoId === clientId;

      return isInPeriod && isCorrectDebet && isCorrectKredit && isClientMatch;
    });

    // Получаем документы для этих проводок
    const docIds = [
      ...new Set(paymentEntries.map((e: Entry) => Number(e.docId))),
    ];
    const documents = await this.documentRepository.findAll({
      where: { id: docIds },
      include: [DocValues],
    });

    // Формируем результат с детализацией
    const details = paymentEntries.map((entry: Entry) => {
      const doc = documents.find(
        (d: Document) => Number(d.id) === Number(entry.docId),
      );
      return {
        docId: entry.docId,
        date: entry.date,
        total: entry.total,
        documentType: entry.documentType,
        documentDate: doc?.date,
        documentNumber: doc?.id,
        comment: doc?.docValues?.comment || "",
      };
    });

    // Сортируем по дате
    details.sort((a, b) => Number(a.date) - Number(b.date));

    return details;
  }

  async getClientDebt(clientId: number, enterpriseId?: number | null) {
    const entries = await this.entriesService.getAllEntries(
      enterpriseId ?? null,
    );

    let debitTurnover = 0;
    let creditTurnover = 0;

    for (const entry of entries) {
      const total = Number((entry as any).total) || 0;

      if ((entry as any).debet === Schet.S40) {
        const isClientDebit =
          Number((entry as any).debetFirstSubcontoId) === Number(clientId) ||
          Number((entry as any).debetSecondSubcontoId) === Number(clientId);
        if (isClientDebit) debitTurnover += total;
      }

      if ((entry as any).kredit === Schet.S40) {
        const isClientCredit =
          Number((entry as any).kreditFirstSubcontoId) === Number(clientId) ||
          Number((entry as any).kreditSecondSubcontoId) === Number(clientId);
        if (isClientCredit) creditTurnover += total;
      }
    }

    return {
      schet: Schet.S40,
      debt: Number((debitTurnover - creditTurnover).toFixed(2)),
      debitTurnover: Number(debitTurnover.toFixed(2)),
      creditTurnover: Number(creditTurnover.toFixed(2)),
      asOf: Date.now(),
    };
  }

  /** Остаток бонуса посредника на счёте S65 (начислено − выплачено). */
  async getMediatorBonusBalance(
    mediatorId: number,
    enterpriseId?: number | null,
  ): Promise<{
    balance: number;
    accrued: number;
    paid: number;
    asOf: number;
  }> {
    const endDate = Date.now();
    const startDate = 0;

    const [POSUM, TDSUM, TKSUM] = await Promise.all([
      query(
        Schet.S65,
        TypeQuery.POSUM,
        startDate,
        endDate,
        mediatorId,
        null,
        null,
        this.stocksService,
        this.oborotsService,
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
        this.stocksService,
        this.oborotsService,
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
        this.stocksService,
        this.oborotsService,
        enterpriseId,
      ),
    ]);

    const opening = Number(POSUM) || 0;
    const accrued = Number(TDSUM) || 0;
    const paid = Number(TKSUM) || 0;
    const balance = opening + accrued - paid;

    return {
      balance: Number(balance.toFixed(2)),
      accrued: Number((opening + accrued).toFixed(2)),
      paid: Number(paid.toFixed(2)),
      asOf: endDate,
    };
  }

  async getClientMovements(
    clientId: number,
    days: number,
    enterpriseId?: number | null,
  ) {
    const safeDays = Math.max(1, Math.min(365, Number(days) || 1));
    const endDate = Date.now();
    const startDate = endDate - safeDays * 24 * 60 * 60 * 1000;

    const entries = await this.entriesService.getAllEntries(
      enterpriseId ?? null,
    );

    const result = entries
      .filter((entry) => {
        const date = Number((entry as any).date) || 0;
        if (date < startDate || date > endDate) return false;

        const isS40 =
          (entry as any).debet === Schet.S40 ||
          (entry as any).kredit === Schet.S40;
        if (!isS40) return false;

        const isClientMatch =
          Number((entry as any).debetFirstSubcontoId) === Number(clientId) ||
          Number((entry as any).debetSecondSubcontoId) === Number(clientId) ||
          Number((entry as any).kreditFirstSubcontoId) === Number(clientId) ||
          Number((entry as any).kreditSecondSubcontoId) === Number(clientId);

        return isClientMatch;
      })
      .sort((a, b) => Number((b as any).date) - Number((a as any).date))
      .map((entry) => ({
        id: (entry as any).id,
        date: Number((entry as any).date),
        docId: (entry as any).docId,
        documentType: (entry as any).documentType,
        debet: (entry as any).debet,
        kredit: (entry as any).kredit,
        total: Number((entry as any).total) || 0,
      }));

    return {
      schet: Schet.S40,
      days: safeDays,
      startDate,
      endDate,
      movements: result,
    };
  }

  async getClients(queryMatOtchet: QuerySimple) {
    const { startDate, endDate, sectionId, enterpriseId } = queryMatOtchet;

    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    const result = clients(
      references,
      startDate,
      endDate,
      sectionId,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
    return result;
  }

  async getAccountOperations(req: QuerySimple) {
    const { schet, startDate, endDate, enterpriseId } = req;

    const [startBalans, endBalans, results] = await Promise.all([
      query(
        schet,
        TypeQuery.POSUM,
        startDate,
        endDate,
        null,
        null,
        null,
        this.stocksService,
        this.oborotsService,
        enterpriseId,
      ),
      query(
        schet,
        TypeQuery.KOSUM,
        startDate,
        endDate,
        null,
        null,
        null,
        this.stocksService,
        this.oborotsService,
        enterpriseId,
      ),
      this.entriesService.getAllEntriesBySchet({
        schet,
        startDate,
        endDate,
        firstSubcontoId: null,
        secondSubcontoId: null,
        thirdSubcontoId: null,
        enterpriseId,
      }),
    ]);

    return { schet, startBalans, endBalans, results };
  }

  async getAktSverka(queryAktSverka: QuerySimple) {
    const { startDate, endDate, sectionId, partnerType, enterpriseId } =
      queryAktSverka;

    const schet =
      partnerType == "CLIENTS"
        ? Schet.S40
        : partnerType == "SUPPLIERS"
          ? Schet.S60
          : Schet.S41;

    let references: any[];

    // Для DEPARTMENTS (S41) - межпредприятийные операции - загружаем всех партнёров без фильтра по enterpriseId
    // Для остальных типов - загружаем с фильтром по enterpriseId
    if (
      partnerType === "DEPARTMENTS" ||
      partnerType === TypePartners.DEPARTMENTS
    ) {
      // Загружаем ВСЕ references без фильтра по enterpriseId
      references = await this.referencesService.getAllReferencesForReport();
    } else {
      // Загружаем references с фильтрацией по enterpriseId
      references =
        await this.referencesService.getReferencesForReport(enterpriseId);
    }

    const result = aktSverka(
      references,
      startDate,
      endDate,
      schet,
      sectionId,
      this.entriesService,
      this.stocksService,
      this.oborotsService,
      enterpriseId,
    );
    return result;
  }

  async getSupplierGoods(querySupplierGoods: QuerySimple) {
    const { startDate, endDate, sectionId, enterpriseId } =
      querySupplierGoods;

    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    return await supplierGoods(
      references,
      startDate,
      endDate,
      sectionId ?? null,
      enterpriseId,
    );
  }

  async getRentalExpectedIncome(
    asOf: number,
    enterpriseId: number,
    clientId?: number | null,
  ) {
    if (!asOf || Number.isNaN(Number(asOf))) {
      throw new BadRequestException("asOf is required");
    }
    if (!enterpriseId || Number.isNaN(Number(enterpriseId))) {
      throw new BadRequestException("enterpriseId is required");
    }
    return rentalExpectedIncome(
      Number(asOf),
      Number(enterpriseId),
      clientId != null && Number(clientId) > 0 ? Number(clientId) : null,
      this.clientToolBatchesService,
      this.referencesService,
    );
  }

  async getSubleaseExpectedIncome(
    asOf: number,
    enterpriseId: number,
    clientId?: number | null,
  ) {
    if (!asOf || Number.isNaN(Number(asOf))) {
      throw new BadRequestException("asOf is required");
    }
    if (!enterpriseId || Number.isNaN(Number(enterpriseId))) {
      throw new BadRequestException("enterpriseId is required");
    }
    return subleaseExpectedIncome(
      Number(asOf),
      Number(enterpriseId),
      clientId != null && Number(clientId) > 0 ? Number(clientId) : null,
      this.subleaseToolBatchesService,
      this.referencesService,
    );
  }

  async getRentalNetProfit(
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    if (!startDate || Number.isNaN(Number(startDate))) {
      throw new BadRequestException("startDate is required");
    }
    if (!endDate || Number.isNaN(Number(endDate))) {
      throw new BadRequestException("endDate is required");
    }
    return rentalNetProfit(
      Number(startDate),
      Number(endDate),
      enterpriseId != null && Number(enterpriseId) > 0
        ? Number(enterpriseId)
        : null,
      this.entryRepository,
    );
  }

  async getRentalNetProfitEntries(
    type: "income" | "cogs" | "otherIncome93",
    startDate: number,
    endDate: number,
    tmzIdsRaw: string,
    enterpriseId?: number | null,
  ) {
    const parsed = String(tmzIdsRaw || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (!parsed.length) return [];

    const hasUnallocated = parsed.includes(-1);
    const concreteIds = parsed.filter((id) => id > 0);

    const where: any = {
      date: { [Op.gte]: startDate, [Op.lte]: endDate },
    };
    if (enterpriseId != null && enterpriseId !== undefined) {
      where.enterpriseId = enterpriseId;
    }

    const secondField =
      type === "cogs" ? "debetSecondSubcontoId" : "kreditSecondSubcontoId";

    if (type === "income") {
      where.kredit = Schet.S90 ?? ("S90" as Schet);
    } else if (type === "otherIncome93") {
      where.debet = Schet.S40 ?? ("S40" as Schet);
      where.kredit = Schet.S93 ?? ("S93" as Schet);
    } else {
      where.debet = Schet.S91 ?? ("S91" as Schet);
    }

    const idFilters: any[] = [];
    if (concreteIds.length) {
      idFilters.push({ [secondField]: { [Op.in]: concreteIds } });
    }
    if (hasUnallocated) {
      idFilters.push({ [secondField]: null });
    }
    if (idFilters.length === 1) {
      Object.assign(where, idFilters[0]);
    } else if (idFilters.length > 1) {
      where[Op.or] = idFilters;
    }

    return this.entryRepository.findAll({
      where,
      include: [
        { association: "document" },
        { association: "debetFirstSubcontoReference" },
        { association: "kreditFirstSubcontoReference" },
        { association: "debetSecondSubcontoReference" },
        { association: "kreditSecondSubcontoReference" },
      ],
      order: [["date", "ASC"], ["id", "ASC"]],
    });
  }

  async getExpenseEntries(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    workshopId: number,
    enterpriseId?: number | null,
  ) {
    return await this.entriesService.getEntriesByExpenseType(
      debet,
      kredit,
      startDate,
      endDate,
      workshopId,
      enterpriseId,
    );
  }

  async getEntriesByDebetKredit(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    subcontoId: number | null,
    subcontoInDebet: boolean,
    enterpriseId?: number | null,
  ) {
    return await this.entriesService.getEntriesByDebetKredit(
      debet,
      kredit,
      startDate,
      endDate,
      subcontoId,
      subcontoInDebet,
      enterpriseId,
    );
  }

  async getEntriesByDebetKreditBatch(
    debet: Schet,
    kredit: Schet,
    startDate: number,
    endDate: number,
    subcontoIds: number[] | null,
    subcontoInDebet: boolean,
    enterpriseId?: number | null,
  ) {
    return await this.entriesService.getEntriesByDebetKreditBatch(
      debet,
      kredit,
      startDate,
      endDate,
      subcontoIds,
      subcontoInDebet,
      enterpriseId,
    );
  }

  async getIncomeDetails(
    workshopId: number,
    startDate: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    // Загружаем references с фильтрацией на уровне БД
    const references =
      await this.referencesService.getReferencesForReport(enterpriseId);

    return await getIncomeDetails(
      workshopId,
      references,
      startDate,
      endDate,
      this.documentsService,
      this.sequelize,
      enterpriseId,
    );
  }

  async getToolsAtClientDetails(
    toolId: number,
    endDate: number,
    enterpriseId?: number | null,
  ) {
    return getToolsAtClientDetails(
      toolId,
      endDate,
      enterpriseId,
      this.referencesService,
    );
  }

  async getFoydaByOrderEntries(
    type: "income" | "expense",
    startDate: number,
    endDate: number,
    orderId: number | null | undefined,
    saleDocId: number | null | undefined,
    debet: Schet | undefined,
    kredit: Schet | undefined,
    enterpriseId?: number | null,
  ) {
    if (type === "income") {
      if (orderId == null || orderId <= 0) {
        return this.entriesService.getUnallocatedIncomeEntries(
          startDate,
          endDate,
          enterpriseId,
        );
      }
      return this.entriesService.getOrderIncomeEntries(
        orderId,
        saleDocId,
        startDate,
        endDate,
        enterpriseId,
      );
    }

    if (!debet || !kredit) {
      return [];
    }

    const resolvedOrderId =
      orderId !== undefined && orderId !== null ? orderId : null;

    return this.entriesService.getOrderExpenseEntries(
      debet,
      kredit,
      resolvedOrderId,
      startDate,
      endDate,
      enterpriseId,
    );
  }

  private schetForTmzType(typeTMZ: TypeTMZ): Schet {
    switch (typeTMZ) {
      case TypeTMZ.MATERIAL:
        return Schet.S10;
      case TypeTMZ.PRODUCT:
        return Schet.S28;
      case TypeTMZ.HALFSTUFF:
        return Schet.S21;
      default:
        throw new BadRequestException(
          `Неподдерживаемый тип ТМЗ для остатка: ${typeTMZ}`,
        );
    }
  }

  /**
   * Средняя цена и остаток ТМЗ на складе (S10 / S21 / S28).
   */
  async getTmzAveragePrice(
    referenceId: number,
    typeTMZ: TypeTMZ,
    enterpriseId: number | null,
    storageId?: number | null,
    endDateMs?: number | null,
  ): Promise<{ price: number; balance: number; source: string }> {
    const oneDay = 24 * 60 * 60 * 1000;
    const schet = this.schetForTmzType(typeTMZ);

    const isMaterial = typeTMZ === TypeTMZ.MATERIAL;
    const firstSubcontoId = isMaterial ? referenceId : Number(storageId || 0);
    const secondSubcontoId = isMaterial ? null : referenceId;

    if (!isMaterial && !firstSubcontoId) {
      return { price: 0, balance: 0, source: "none" };
    }

    const endDate =
      endDateMs != null && Number.isFinite(Number(endDateMs)) && Number(endDateMs) > 0
        ? Number(endDateMs)
        : Date.now() + oneDay;

    const stock = await this.getPriceAndBalance({
      schet,
      endDate,
      firstSubcontoId,
      secondSubcontoId,
      enterpriseId,
    } as QuerySimple);

    if (stock.price > 0) {
      return {
        price: stock.price,
        balance: Number(stock.balance || 0),
        source: "stock",
      };
    }

    if (isMaterial) {
      const fallback = await this.getMaterialAveragePrice(
        referenceId,
        enterpriseId,
      );
      return {
        price: fallback.price,
        balance: Number(stock.balance || 0),
        source: fallback.source,
      };
    }

    return {
      price: 0,
      balance: Number(stock.balance || 0),
      source: "none",
    };
  }

  async getMaterialAveragePrice(
    materialId: number,
    enterpriseId: number | null,
  ): Promise<{ price: number; source: string }> {
    const oneDay = 24 * 60 * 60 * 1000;
    const stock = await this.getPriceAndBalance({
      schet: Schet.S10,
      endDate: Date.now() + oneDay,
      firstSubcontoId: materialId,
      secondSubcontoId: null,
      enterpriseId,
    } as QuerySimple);

    if (stock.price > 0) {
      return { price: stock.price, source: "stock" };
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const whereClause: any = {
      debet: Schet.S10,
      kredit: Schet.S60,
      debetSecondSubcontoId: materialId,
      date: { [Op.gte]: sixMonthsAgo.getTime() },
    };
    if (enterpriseId != null) {
      whereClause.enterpriseId = enterpriseId;
    }

    const result: any = await this.entryRepository.findOne({
      attributes: [
        [Sequelize.fn("SUM", Sequelize.col("total")), "sumTotal"],
        [Sequelize.fn("SUM", Sequelize.col("count")), "sumCount"],
      ],
      where: whereClause,
      raw: true,
    });

    const sumTotal = Number(result?.sumTotal) || 0;
    const sumCount = Number(result?.sumCount) || 0;
    const avgPrice = sumCount > 0 ? +(sumTotal / sumCount).toFixed(5) : 0;

    return { price: avgPrice, source: avgPrice > 0 ? "income_6m" : "none" };
  }

  async getMaterialAveragePrices(
    materialIds: number[],
    enterpriseId: number | null,
  ): Promise<Record<number, number>> {
    if (!materialIds || materialIds.length === 0) return {};

    const priceMap: Record<number, number> = {};
    const needFallback: number[] = [];

    const oneDay = 24 * 60 * 60 * 1000;
    for (const mid of materialIds) {
      const stock = await this.getPriceAndBalance({
        schet: Schet.S10,
        endDate: Date.now() + oneDay,
        firstSubcontoId: mid,
        secondSubcontoId: null,
        enterpriseId,
      } as QuerySimple);

      if (stock.price > 0) {
        priceMap[mid] = stock.price;
      } else {
        needFallback.push(mid);
      }
    }

    if (needFallback.length > 0) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const whereClause: any = {
        debet: Schet.S10,
        kredit: Schet.S60,
        debetSecondSubcontoId: { [Op.in]: needFallback },
        date: { [Op.gte]: sixMonthsAgo.getTime() },
      };
      if (enterpriseId != null) {
        whereClause.enterpriseId = enterpriseId;
      }

      const rows: any[] = await this.entryRepository.findAll({
        attributes: [
          "debetSecondSubcontoId",
          [Sequelize.fn("SUM", Sequelize.col("total")), "sumTotal"],
          [Sequelize.fn("SUM", Sequelize.col("count")), "sumCount"],
        ],
        where: whereClause,
        group: ["debetSecondSubcontoId"],
        raw: true,
      });

      for (const row of rows) {
        const mid = Number(row.debetSecondSubcontoId);
        const sumTotal = Number(row.sumTotal) || 0;
        const sumCount = Number(row.sumCount) || 0;
        if (sumCount > 0) {
          priceMap[mid] = +(sumTotal / sumCount).toFixed(5);
        }
      }

      for (const mid of needFallback) {
        if (priceMap[mid] === undefined) {
          priceMap[mid] = 0;
        }
      }
    }

    return priceMap;
  }
}
