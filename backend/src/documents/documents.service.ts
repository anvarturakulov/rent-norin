import { forwardRef, Inject, Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize, Transaction } from "sequelize"; // Импорт из sequelize
import { Document } from "./document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { Enterprise } from "src/enterprises/enterprise.model";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { UpdateCreateDocumentDto } from "./dto/updateCreateDocument.dto";
import { DocTableItemDto } from "./dto/docTableItem.dto";
import { DocValuesDto } from "./dto/docValues.dto";
import { Entry } from "src/entries/entry.model";
import { prepareEntrysList } from "./helper/entry/prepareEntrysList";
import {
  ADVANCE_PHASE,
  buildAdvanceCloseEntries,
  buildAdvanceIssueEntries,
} from "./helper/entry/advanceEntries";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { ConfigService } from "@nestjs/config";
import * as TelegramBot from "node-telegram-bot-api";
import { ReferencesService } from "src/references/references.service";
import { UsersService } from "src/users/users.service";
import { col, fn, Op } from "sequelize"; // Используем импорт вместо require
import { EntriesService } from "src/entries/entries.service";
import { ProductCalculationsService } from "src/productCalculations/productCalculations.service";
import { SettingsService } from "src/settings/settings.service";
import { EntryCreationAttrs } from "src/entries/entry.model";
import {
  resolveReceiverDocumentType,
  resolveSenderDocumentType,
} from "./document.constants";
import { Schet } from "src/interfaces/report.interface";
import {
  TypeReference,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { UserRoles } from "src/interfaces/user.interface";
import {
  buildOsAmortizationPreviewLines,
  getMonthBoundsFromDocDate,
} from "./helper/osAmortization.helper";
import { ClientToolBatchesService } from "src/clientToolBatches/clientToolBatches.service";
import { SubleaseToolBatchesService } from "src/subleaseToolBatches/subleaseToolBatches.service";
import { PereodicService } from "src/pereodic/pereodic.service";
import { TransferToolsPreviewRow } from "./transferToolsPreview.types";
import { getRentTariffPriceName } from "./helper/rentTariffType";
import {
  matchReadyRentalOrders,
  missingStockLines,
  RentalOrderNeed,
} from "./helper/rentalOrderMatch";
import { MediatorTelegramNotifierService } from "src/telegram/mediator-telegram-notifier.service";
import { RentalClientTelegramNotifierService } from "src/telegram/rental-client-telegram-notifier.service";
import { FurnitureSalaryTelegramNotifierService } from "src/telegram/furniture-salary-telegram-notifier.service";
import { isZavskladEditableDocumentType } from "./helper/zavskladDocuments.helper";
import { getReceiveToolsDiscountError, getReceiveToolsSalePriceError } from "./helper/mediatorBonus.helper";
import {
  DATE_BAN_EDITING_MESSAGE,
  isDocumentDateBanned,
} from "./helper/dateBanEditing.helper";
import { ClientContractItemLine } from "src/clientContracts/clientContractItemLine.model";
import { ClientContractOrderLine } from "src/clientContracts/clientContractOrderLine.model";

// Константа даты запуска межпредприятийских проводок для получателя (1 декабря 2024, 00:00:00 UTC)
const INTER_ENTERPRISE_RECEIVER_ENTRIES_START_DATE = 1730419200000;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private normalizeDocValuesPayload(
    docValues?: DocValuesDto | null,
  ): Record<string, any> {
    if (!docValues) {
      return {};
    }

    const {
      id: _docValuesId,
      docId: _docValuesDocId,
      createdAt: _docValuesCreatedAt,
      updatedAt: _docValuesUpdatedAt,
      calculatedCostTotal: _calculatedCostTotal,
      deadlineDate,
      ...rest
    } = docValues;

    const normalizedDeadline =
      deadlineDate === null || deadlineDate === undefined || deadlineDate === ""
        ? undefined
        : BigInt(deadlineDate as string | number);

    // Фильтруем undefined значения, чтобы они не попадали в запрос к БД
    // Sequelize будет использовать defaultValue из модели для этих полей
    const filteredRest = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== undefined),
    );

    return {
      ...filteredRest,
      deadlineDate: normalizedDeadline,
    } as Record<string, any>;
  }

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Document) private documentRepository: typeof Document,
    @InjectModel(DocValues) private docValuesRepository: typeof DocValues,
    @InjectModel(DocTableItems)
    private docTableItemsRepository: typeof DocTableItems,
    @InjectModel(Entry) private entryRepository: typeof Entry,
    private stocksService: StocksService,
    private oborotsService: OborotsService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ReferencesService))
    private referencesService: ReferencesService,
    private usersService: UsersService,
    private settingsService: SettingsService,
    private clientToolBatchesService: ClientToolBatchesService,
    private subleaseToolBatchesService: SubleaseToolBatchesService,
    private pereodicService: PereodicService,
    @Inject(forwardRef(() => MediatorTelegramNotifierService))
    private mediatorTelegramNotifier: MediatorTelegramNotifierService,
    @Inject(forwardRef(() => RentalClientTelegramNotifierService))
    private rentalClientTelegramNotifier: RentalClientTelegramNotifierService,
    @Inject(forwardRef(() => FurnitureSalaryTelegramNotifierService))
    private furnitureSalaryTelegramNotifier: FurnitureSalaryTelegramNotifierService,
  ) {}

  private notifyMediatorTelegramAsync(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): void {
    void this.mediatorTelegramNotifier.notifyAfterDocumentPosted(doc, entries);
  }

  private notifyRentalClientTelegramAsync(doc: Document): void {
    void this.rentalClientTelegramNotifier.notifyAfterDocumentPosted(doc);
  }

  private async persistEntries(
    entrysList: EntryCreationAttrs[],
    enterpriseId: number,
    transaction: Transaction,
  ) {
    for (const item of entrysList) {
      const { targetEnterpriseId, enterpriseId: entryEnterprise, ...entryData } =
        item;
      const entryEnterpriseId =
        targetEnterpriseId ?? entryEnterprise ?? enterpriseId;
      const entry = await this.entryRepository.create(
        { ...entryData, enterpriseId: entryEnterpriseId },
        { transaction },
      );
      await this.stocksService.addTwoEntries(entry, transaction);
      await this.stocksService.addEntrieToTMZ(entry, transaction);
      await this.oborotsService.addEntry(entry, transaction);
    }
  }

  private async reverseEntries(docId: bigint | number, transaction: Transaction) {
    const entrysList = await this.entryRepository.findAll({
      where: { docId },
      transaction,
    });
    for (const entry of entrysList) {
      await this.stocksService.deleteTwoEntries(entry, transaction);
      await this.stocksService.deleteEntrieToTMZ(entry, transaction);
      await this.oborotsService.deleteEntry(entry, transaction);
    }
    if (entrysList.length > 0) {
      await this.entryRepository.destroy({
        where: { docId },
        transaction,
      });
    }
  }

  /** Выдача аванса оставляет документ OPEN. Закрытие ставит PROVEDEN. */
  private async applyAdvanceOnSave(doc: Document, transaction: Transaction) {
    if (!doc.docValues) {
      throw new Error("Аванс ҳужжатининг қийматлари топилмади");
    }
    const phase = doc.docValues?.advancePhase;
    const enterpriseId = Number(doc.enterpriseId) || 0;
    if (!enterpriseId) {
      throw new Error("Ҳужжат корхонаси аниқланмади");
    }
    if (phase === ADVANCE_PHASE.CLOSED || doc.docStatus === DocSTATUS.PROVEDEN) {
      if (doc.docStatus === DocSTATUS.PROVEDEN) {
        throw new Error("Аванс аллақачон ёпилган");
      }
      const closedEntries = await this.entryRepository.findAll({
        where: { docId: doc.id },
        transaction,
      });
      if (closedEntries.length > 0) {
        throw new Error("Аванс аллақачон ёпилган");
      }
      await doc.docValues.update(
        { advancePhase: ADVANCE_PHASE.DRAFT },
        { transaction },
      );
    }
    if (phase === ADVANCE_PHASE.ISSUED) {
      const entries = await buildAdvanceCloseEntries(doc, this.referencesService);
      await this.persistEntries(entries, enterpriseId, transaction);
      await doc.update({ docStatus: DocSTATUS.PROVEDEN }, { transaction });
      await doc.docValues.update(
        { advancePhase: ADVANCE_PHASE.CLOSED },
        { transaction },
      );
      return;
    }
    const existing = await this.entryRepository.findAll({
      where: { docId: doc.id },
      transaction,
    });
    if (existing.length > 0) {
      throw new Error("Аванс аллақачон берилган");
    }
    const entries = buildAdvanceIssueEntries(doc);
    await this.persistEntries(entries, enterpriseId, transaction);
    await doc.docValues.update(
      { advancePhase: ADVANCE_PHASE.ISSUED },
      { transaction },
    );
  }

  private async assertDocumentDateEditable(
    ...dates: Array<unknown>
  ): Promise<void> {
    const banValue = await this.settingsService.getDateBanEditingValue();
    for (const date of dates) {
      if (isDocumentDateBanned(date, banValue)) {
        throw new BadRequestException(DATE_BAN_EDITING_MESSAGE);
      }
    }
  }

  private maybeNotifyRentalClient(doc: Document): void {
    const rentalTypes = new Set<DocumentType>([
      DocumentType.TransferToolsToClient,
      DocumentType.ReceiveToolsFromClient,
      DocumentType.ComeCashFromClients,
    ]);
    if (
      rentalTypes.has(doc.documentType as DocumentType) &&
      doc.docStatus === DocSTATUS.PROVEDEN
    ) {
      this.notifyRentalClientTelegramAsync(doc);
    }
  }

  private notifyWorkerSalaryTelegramPostedAsync(
    doc: Document,
    entries?: EntryCreationAttrs[],
  ): void {
    void this.notifyWorkerSalaryTelegramAsync(doc, entries, "posted");
  }

  private notifyWorkerSalaryTelegramCancelledAsync(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): void {
    void this.notifyWorkerSalaryTelegramAsync(doc, entries, "cancelled");
  }

  private async notifyWorkerSalaryTelegramAsync(
    doc: Document,
    entries: EntryCreationAttrs[] | undefined,
    action: "posted" | "cancelled",
  ): Promise<void> {
    if (
      doc.documentType !== DocumentType.LeaveCash &&
      doc.documentType !== DocumentType.ZpCalculate
    ) {
      return;
    }
    if (
      doc.documentType === DocumentType.LeaveCash &&
      !doc.docValues?.isWorker
    ) {
      return;
    }

    let entryList = entries;
    if (!entryList?.length && action === "posted") {
      const rows = await this.entryRepository.findAll({
        where: { docId: doc.id },
      });
      entryList = rows.map((row) => row.dataValues as EntryCreationAttrs);
    }
    if (!entryList?.length) return;

    if (action === "posted") {
      await this.furnitureSalaryTelegramNotifier.notifyAfterDocumentPosted(
        doc,
        entryList,
      );
    } else {
      await this.furnitureSalaryTelegramNotifier.notifyAfterDocumentCancelled(
        doc,
        entryList,
      );
    }
  }

  /**
   * Внутренние документы: сразу PROVEDEN и проводки при создании/обновлении (как при SINGLE_ENTERPRISE_MODE).
   * Не используется в resolveInterEnterpriseContext — межпредприятийная логика не отключается.
   */
  private shouldAutoProveInternalDocs(): boolean {
    return (
      this.configService.get("SINGLE_ENTERPRISE_MODE") === "true" ||
      this.configService.get("AVTO_PROVODKA_IN_MANY_ENTERPRISE_MODE") === "true"
    );
  }

  // Вспомогательная функция для трансформации документа: для получателя показываем documentTypeForReceiver
  private transformDocumentForViewer(doc: any, enterpriseId?: number): any {
    const docJson = doc.toJSON ? doc.toJSON() : doc;
    if (
      doc.isInterEnterprise &&
      enterpriseId !== undefined &&
      doc.targetEnterpriseId === enterpriseId &&
      doc.documentTypeForReceiver
    ) {
      // Для получателя заменяем documentType на documentTypeForReceiver
      docJson.documentType = doc.documentTypeForReceiver;
    }

    // Массив типов документов с табличной частью
    const documentsWithTableItems = [
      DocumentType.ComeMaterial,
      DocumentType.ComeTools,
      DocumentType.ComeTovar,
      DocumentType.LeaveMaterial,
      DocumentType.LeaveTools,
      DocumentType.LeaveTovar,
      DocumentType.LeaveProd,
      DocumentType.LeaveHalfstuff,
      DocumentType.MoveProd,
      DocumentType.MoveMaterial,
      DocumentType.MoveTools,
      DocumentType.MoveHalfstuff,
      DocumentType.SaleHalfStuff,
      DocumentType.SaleMaterial,
      DocumentType.SaleProd,
      DocumentType.SaleTovar,
      DocumentType.SaleTools,
      DocumentType.TransferToolsToClient,
      DocumentType.ReceiveToolsFromClient,
      DocumentType.ComeOS,
      DocumentType.LeaveOS,
      DocumentType.MoveOS,
      DocumentType.SaleOS,
      DocumentType.AmortizasiyaOS,
    ];

    // Вычисляем сумму для ВСЕХ документов с табличной частью
    // Это нужно для корректного отображения в журнале
    if (
      docJson.docValues &&
      docJson.docTableItems &&
      docJson.docTableItems.length > 0 &&
      documentsWithTableItems.includes(docJson.documentType)
    ) {
      const itemsToSum = docJson.docTableItems;

      const calculatedTotal = itemsToSum.reduce(
        (sum, item) => sum + (item.total || 0),
        0,
      );
      const calculatedCount = itemsToSum.reduce(
        (sum, item) => sum + (item.count || 0),
        0,
      );
      const calculatedCostTotal = itemsToSum.reduce(
        (sum, item) => sum + (item.costTotal || 0),
        0,
      );

      // Обновляем значения в docValues для корректного отображения в журнале
      // Для ВСЕХ документов с табличной частью
      docJson.docValues.total = calculatedTotal;
      docJson.docValues.count = calculatedCount;

      // Себестоимость вычисляем для SaleProd, SaleTovar и SaleTools (используется в футере журнала)
      if (
        docJson.documentType === DocumentType.SaleProd ||
        docJson.documentType === DocumentType.SaleTovar ||
        docJson.documentType === DocumentType.SaleTools
      ) {
        docJson.docValues.calculatedCostTotal = calculatedCostTotal;
      }
    }

    return docJson;
  }

  // Методы чтения с фильтрацией по enterpriseId
  async getAllDocuments(enterpriseId?: number, isSuperUser?: boolean) {
    const where: any = {};

    if (enterpriseId !== undefined && !isSuperUser) {
      where[Op.or] = [
        { enterpriseId },
        { isInterEnterprise: true, sourceEnterpriseId: enterpriseId },
        // Для получателя исключаем документы со статусом OPEN (отмененные отправки)
        {
          isInterEnterprise: true,
          targetEnterpriseId: enterpriseId,
          docStatus: { [Op.ne]: DocSTATUS.OPEN },
        },
      ];
    }

    const documents = await this.documentRepository.findAll({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: [
        DocValues,
        // DocTableItems убран для оптимизации - загружается только при открытии документа
        { model: Enterprise, as: "enterprise" },
        { model: Enterprise, as: "sourceEnterprise" },
        { model: Enterprise, as: "targetEnterprise" },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Трансформируем документы: для получателя показываем documentTypeForReceiver
    return documents.map((doc) =>
      this.transformDocumentForViewer(doc, enterpriseId),
    );
  }

  private buildDocumentTypeOrCondition(
    documentType: DocumentType,
    enterpriseId?: number,
    isSuperUser?: boolean,
  ): Record<string, unknown> {
    if (documentType === DocumentType.Advance) {
      return { documentType };
    }

    if (enterpriseId !== undefined && !isSuperUser) {
      return {
        [Op.or]: [
          { enterpriseId, documentType },
          {
            isInterEnterprise: true,
            sourceEnterpriseId: enterpriseId,
            documentType,
          },
          {
            isInterEnterprise: true,
            targetEnterpriseId: enterpriseId,
            documentTypeForReceiver: documentType,
            docStatus: { [Op.ne]: DocSTATUS.OPEN },
          },
        ],
      };
    }

    return {
      [Op.or]: [
        { documentType },
        { isInterEnterprise: true, documentTypeForReceiver: documentType },
        { isInterEnterprise: true, documentType },
      ],
    };
  }

  private buildDocumentTypeWhere(
    documentType: DocumentType,
    enterpriseId?: number,
    isSuperUser?: boolean,
    options?: { excludeDeleted?: boolean; docStatus?: DocSTATUS },
  ): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = [
      this.buildDocumentTypeOrCondition(documentType, enterpriseId, isSuperUser),
    ];

    if (options?.excludeDeleted) {
      conditions.push({ docStatus: { [Op.ne]: DocSTATUS.DELETED } });
    }

    if (options?.docStatus) {
      conditions.push({ docStatus: options.docStatus });
    }

    return conditions.length === 1 ? conditions[0] : { [Op.and]: conditions };
  }

  async getJournalMeta(
    documentType: DocumentType,
    enterpriseId?: number,
    isSuperUser?: boolean,
  ) {
    const where = this.buildDocumentTypeWhere(documentType, enterpriseId, isSuperUser, {
      excludeDeleted: true,
    });

    const lastDoc = (await this.documentRepository.findOne({
      where,
      attributes: ["date"],
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      raw: true,
    })) as { date?: string | number | null } | null;

    const modifiedRow = (await this.documentRepository.findOne({
      where,
      attributes: [[fn("MAX", col("updatedAt")), "lastModifiedAt"]],
      raw: true,
    })) as { lastModifiedAt?: Date | string | null } | null;

    return {
      lastDocumentDate:
        lastDoc?.date != null ? Number(lastDoc.date) : null,
      lastModifiedAt: modifiedRow?.lastModifiedAt ?? null,
    };
  }

  async getAllDocumentsByType(
    documentType,
    enterpriseId?: number,
    isSuperUser?: boolean,
  ) {
    const where = this.buildDocumentTypeWhere(documentType, enterpriseId, isSuperUser);

    const documents = await this.documentRepository.findAll({
      where,
      include: [
        DocValues,
        // DocTableItems убран для оптимизации - загружается только при открытии документа
        { model: Enterprise, as: "enterprise" },
        { model: Enterprise, as: "sourceEnterprise" },
        { model: Enterprise, as: "targetEnterprise" },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Трансформируем документы: для получателя показываем documentTypeForReceiver
    return documents.map((doc) =>
      this.transformDocumentForViewer(doc, enterpriseId),
    );
  }

  async getAllDocumentsByTypeForDate(
    documentType,
    dateStart: number,
    dateEnd: number,
    enterpriseId?: number,
    isSuperUser?: boolean,
    docStatus?: DocSTATUS,
  ) {
    const typeWhere = this.buildDocumentTypeWhere(
      documentType,
      enterpriseId,
      isSuperUser,
      docStatus ? { docStatus } : undefined,
    );

    const where = {
      [Op.and]: [
        {
          date: {
            [Op.gte]: dateStart,
            [Op.lte]: dateEnd,
          },
        },
        typeWhere,
      ],
    };

    const documents = await this.documentRepository.findAll({
      where,
      include: [
        DocValues,
        DocTableItems, // Загружаем для корректного расчета суммы в документах с табличной частью
        { model: Enterprise, as: "enterprise" },
        { model: Enterprise, as: "sourceEnterprise" },
        { model: Enterprise, as: "targetEnterprise" },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Трансформируем документы: для получателя показываем documentTypeForReceiver
    // И вычисляем сумму для документов с табличной частью
    return documents.map((doc) =>
      this.transformDocumentForViewer(doc, enterpriseId),
    );
  }

  async getAllDocsByDate(
    dateStart: number,
    dateEnd: number,
    enterpriseId?: number,
    isSuperUser?: boolean,
  ) {
    const baseWhere: any = {
      date: {
        [Op.gte]: dateStart,
        [Op.lte]: dateEnd,
      },
    };

    let where: any = baseWhere;

    if (enterpriseId !== undefined && !isSuperUser) {
      where = {
        [Op.and]: [
          baseWhere,
          {
            [Op.or]: [
              { enterpriseId },
              { isInterEnterprise: true, sourceEnterpriseId: enterpriseId },
              { isInterEnterprise: true, targetEnterpriseId: enterpriseId },
            ],
          },
        ],
      };
    }

    const documents = await this.documentRepository.findAll({
      where,
      include: [
        DocValues,
        DocTableItems, // Загружаем DocTableItems для вычисления суммы документов с табличной частью
        { model: Enterprise, as: "enterprise" },
        { model: Enterprise, as: "sourceEnterprise" },
        { model: Enterprise, as: "targetEnterprise" },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    // Трансформируем документы: для получателя показываем documentTypeForReceiver
    return documents.map((doc) =>
      this.transformDocumentForViewer(doc, enterpriseId),
    );
  }

  async getDocumentById(id: number, enterpriseId?: number) {
    const document = await this.documentRepository.findOne({
      where: { id },
      include: [
        DocValues,
        DocTableItems,
        { model: Enterprise, as: "enterprise" },
        { model: Enterprise, as: "sourceEnterprise" },
        { model: Enterprise, as: "targetEnterprise" },
      ],
    });

    if (!document) {
      return null;
    }

    // Трансформируем документ: для получателя показываем documentTypeForReceiver
    return this.transformDocumentForViewer(document, enterpriseId);
  }

  // Обновлённая функция updateDocumentById с транзакциями
  async updateDocumentById(id: number, dto: UpdateCreateDocumentDto) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date, dto.date);

    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues, DocTableItems],
        transaction,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      const priorDocStatus = document.docStatus;
      let rentalClientNotifyAfterCommit = false;

      // Логируем состояние документа при попытке обновления
      console.log(
        `[updateDocumentById] Document ${id} loaded from DB: isLocked=${document.isLocked}, docStatus=${document.docStatus}, isInterEnterprise=${document.isInterEnterprise}`,
      );
      this.logger.log(
        `[updateDocumentById] Document ${id} loaded from DB: isLocked=${document.isLocked}, docStatus=${document.docStatus}, isInterEnterprise=${document.isInterEnterprise}`,
      );

      if (document.isLocked) {
        console.log(
          `[updateDocumentById] ERROR: Document ${id} is locked! isLocked=${document.isLocked}`,
        );
        this.logger.error(
          `[updateDocumentById] Document ${id} is locked! isLocked=${document.isLocked}`,
        );
        throw new Error("Document is locked and cannot be modified");
      }

      if (
        document.isInterEnterprise &&
        ![DocSTATUS.OPEN, DocSTATUS.REJECTED].includes(document.docStatus)
      ) {
        throw new Error(
          "Inter-enterprise document cannot be modified in its current status",
        );
      }

      if (
        document.docStatus === DocSTATUS.PROVEDEN &&
        !document.isInterEnterprise
      ) {
        throw new Error(
          "Нельзя изменить проведённый документ. Сначала отмените проводку, затем перепроведите.",
        );
      }

      // Для уже существующих межпредприятийных документов сохраняем исходные значения
      const wasInterEnterprise = document.isInterEnterprise;
      const originalSourceEnterpriseId = document.sourceEnterpriseId;
      const originalTargetEnterpriseId = document.targetEnterpriseId;
      const originalDocumentTypeForSender = document.documentTypeForSender;
      const originalDocumentTypeForReceiver = document.documentTypeForReceiver;
      const originalReceiverId = document.docValues?.receiverId;

      // Аванс остаётся на предприятии, которое его выдало, даже если сохраняет кассир другой организации.
      const currentEnterpriseId =
        document.documentType === DocumentType.Advance
          ? (document.enterpriseId ?? null)
          : wasInterEnterprise && originalSourceEnterpriseId
            ? originalSourceEnterpriseId
            : (dto.enterpriseId ?? document.enterpriseId ?? null);

      const referenceIdForInterEnterprise =
        dto.documentType === DocumentType.Advance
          ? null
          : dto.docValues?.receiverId;
      const receiverIdChanged =
        originalReceiverId !== referenceIdForInterEnterprise;

      // Получаем user.enterpriseId для проверки межпредприятийности
      const user = dto.userId
        ? await this.usersService.getUserById(dto.userId)
        : null;
      const userEnterpriseId = user?.enterpriseId ?? null;

      let interContext;

      // Пересчитываем контекст только если:
      // 1. Документ еще не был межпредприятийным, ИЛИ
      // 2. receiverId изменился
      if (!wasInterEnterprise || receiverIdChanged) {
        interContext = await this.resolveInterEnterpriseContext(
          referenceIdForInterEnterprise,
          dto.documentType,
          currentEnterpriseId,
          userEnterpriseId,
        );
      } else {
        // Сохраняем исходные значения для существующих межпредприятийных документов
        interContext = {
          isInterEnterprise: true,
          sourceEnterpriseId: originalSourceEnterpriseId,
          targetEnterpriseId: originalTargetEnterpriseId,
          documentTypeForSender: originalDocumentTypeForSender,
          documentTypeForReceiver: originalDocumentTypeForReceiver,
        };
      }

      // Обновляем основные поля документа
      await document.update(
        {
          date: dto.date,
          documentType: dto.documentType,
          enterpriseId: interContext.isInterEnterprise
            ? null
            : (currentEnterpriseId ?? null),
          isInterEnterprise: interContext.isInterEnterprise,
          sourceEnterpriseId: interContext.isInterEnterprise
            ? interContext.sourceEnterpriseId
            : null,
          targetEnterpriseId: interContext.isInterEnterprise
            ? interContext.targetEnterpriseId
            : null,
          documentTypeForSender: interContext.isInterEnterprise
            ? interContext.documentTypeForSender
            : null,
          documentTypeForReceiver: interContext.isInterEnterprise
            ? interContext.documentTypeForReceiver
            : null,
          rejectionReason: interContext.isInterEnterprise
            ? document.rejectionReason
            : null,
        },
        { transaction },
      );

      // Обновляем или создаём DocValues
      // В проведённом документе запрещаем менять Накладной расми:
      // пути изображений остаются такими, как в БД.
      if (
        document.docStatus === DocSTATUS.PROVEDEN &&
        document.docValues &&
        (document.docValues.invoiceImagePath ||
          document.docValues.invoiceImagePath2 ||
          document.docValues.invoiceImagePath3)
      ) {
        if (!dto.docValues) {
          dto.docValues = {} as any;
        }
        dto.docValues.invoiceImagePath = document.docValues.invoiceImagePath;
        dto.docValues.invoiceImagePath2 = document.docValues.invoiceImagePath2;
        dto.docValues.invoiceImagePath3 = document.docValues.invoiceImagePath3;
      }

      const docValuesPayload = this.normalizeDocValuesPayload(dto.docValues);

      // Для GateIncome устанавливаем дефолтные значения senderId и receiverId если они не указаны
      let finalSenderId = docValuesPayload.senderId;
      let finalReceiverId = docValuesPayload.receiverId;

      if (dto.documentType === DocumentType.GateIncome) {
        // Для GateIncome используем дефолтное хранилище если значения не указаны
        if (!finalSenderId || finalSenderId === 0) {
          const commonStorageId =
            await this.settingsService.getSettingByKey("commonStorageId");
          finalSenderId = commonStorageId ? Number(commonStorageId) : 20125; // Дефолтное хранилище
        }
        if (!finalReceiverId || finalReceiverId === 0) {
          const commonStorageId =
            await this.settingsService.getSettingByKey("commonStorageId");
          finalReceiverId = commonStorageId ? Number(commonStorageId) : 20125; // Дефолтное хранилище
        }
      }

      if (document.docValues) {
        // Для LeaveMaterial явно сохраняем materialResponsiblePersonId
        const updatePayload: any = {
          ...docValuesPayload,
          senderId: finalSenderId,
          receiverId: finalReceiverId,
        };

        if (
          dto.documentType === DocumentType.LeaveMaterial ||
          dto.documentType === DocumentType.TransferToolsToClient
        ) {
          if (dto.docValues?.materialResponsiblePersonId !== undefined) {
            updatePayload.materialResponsiblePersonId =
              dto.docValues.materialResponsiblePersonId || null;
          }
        }

        if (
          dto.documentType === DocumentType.Advance &&
          document.docValues.advancePhase === ADVANCE_PHASE.ISSUED
        ) {
          updatePayload.senderId = document.docValues.senderId;
          updatePayload.receiverId = document.docValues.receiverId;
          updatePayload.analiticId = document.docValues.analiticId;
          updatePayload.total = document.docValues.total;
          updatePayload.usd = document.docValues.usd;
          updatePayload.currency = document.docValues.currency;
          updatePayload.advancePhase = ADVANCE_PHASE.ISSUED;
        }

        await document.docValues.update(updatePayload, { transaction });
      } else {
        await this.docValuesRepository.create(
          {
            ...docValuesPayload,
            docId: BigInt(document.id),
            senderId: finalSenderId,
            receiverId: finalReceiverId,
          } as any,
          { transaction },
        );
      }

      // Удаляем старые элементы таблицы и создаём новые
      await this.docTableItemsRepository.destroy({
        where: { docId: document.id },
        transaction,
      });

      const items =
        dto.docTableItems && Array.isArray(dto.docTableItems)
          ? [...dto.docTableItems]
          : [];

      // Очищаем элементы от служебных полей и undefined значений
      const itemsToSave = items.map((item) => {
        // Удаляем служебные поля, которые не должны передаваться при создании
        const { id, docId, createdAt, updatedAt, comment, ...cleanItem } =
          item as any;

        // Заменяем undefined на null или удаляем для опциональных полей
        const cleaned: any = {};
        Object.keys(cleanItem).forEach((key) => {
          const value = cleanItem[key];
          if (value !== undefined) {
            cleaned[key] = value;
          }
        });

        // Устанавливаем обязательные поля с дефолтными значениями, если они undefined
        cleaned.docId = document.id;
        cleaned.analiticId = cleaned.analiticId ?? 0;
        cleaned.balance = cleaned.balance ?? 0;
        cleaned.count = cleaned.count ?? 0;
        cleaned.price = cleaned.price ?? 0;
        cleaned.total = cleaned.total ?? 0;
        cleaned.costPrice = cleaned.costPrice ?? 0;
        cleaned.costTotal = cleaned.costTotal ?? 0;

        return cleaned;
      });

      this.assertReceiveToolsDiscountValid(dto.documentType, itemsToSave);

      if (itemsToSave.length > 0) {
        await Promise.all(
          itemsToSave.map((item) =>
            this.docTableItemsRepository.create(item, { transaction }),
          ),
        );
      }

      const documentReloaded = await this.documentRepository.findOne({
        where: { id: document.id },
        include: [DocValues, DocTableItems],
        transaction,
      });

      const enterpriseIdForProvodka: number | null =
        interContext.isInterEnterprise
          ? null
          : (currentEnterpriseId ?? document.enterpriseId ?? null);

      if (
        documentReloaded &&
        document.documentType === DocumentType.Advance &&
        !dto.saveOnly
      ) {
        await this.applyAdvanceOnSave(documentReloaded, transaction);
      }

      if (
        documentReloaded &&
        document.documentType !== DocumentType.Advance &&
        enterpriseIdForProvodka !== null &&
        !dto.saveOnly
      ) {
        rentalClientNotifyAfterCommit =
          await this.autoProveInternalDocumentAfterUpdateIfSingleEnterprise(
            document,
            documentReloaded,
            priorDocStatus,
            interContext.isInterEnterprise,
            enterpriseIdForProvodka,
            transaction,
          );
      }

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      if (rentalClientNotifyAfterCommit) {
        const docForNotify = await this.documentRepository.findOne({
          where: { id: document.id },
          include: [DocValues, DocTableItems],
        });
        if (docForNotify) {
          this.maybeNotifyRentalClient(docForNotify);
          this.notifyWorkerSalaryTelegramPostedAsync(docForNotify);
        }
      }

      // Перезагружаем документ с табличной частью для возврата
      const updatedDocument = await this.documentRepository.findOne({
        where: { id: document.id },
        include: [DocValues, DocTableItems],
      });

      return updatedDocument || document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to update document ${id}: ${error.message}`);
    }
  }

  async createDocument(
    dto: UpdateCreateDocumentDto,
    usersSer: UsersService,
    refSer: ReferencesService,
    bot?: TelegramBot,
  ) {
    await this.assertDocumentDateEditable(dto.date);

    const transaction = await this.sequelize.transaction();
    let mediatorTelegramPayload: {
      doc: Document;
      entries: EntryCreationAttrs[];
    } | null = null;
    try {
      const currentEnterpriseId = dto.enterpriseId ?? 1;
      const referenceIdForInterEnterprise =
        dto.documentType === DocumentType.Advance
          ? null
          : dto.docValues?.receiverId;

      const authorUserId = Number(dto.userId) || 0;
      if (!authorUserId) {
        throw new BadRequestException(
          "userId обязателен для создания документа",
        );
      }

      // Получаем user.enterpriseId для проверки межпредприятийности
      const user = await usersSer.getUserById(authorUserId);
      if (!user) {
        throw new BadRequestException(
          `Пользователь userId=${authorUserId} не найден`,
        );
      }
      const userEnterpriseId = user.enterpriseId ?? null;

      const interContext = await this.resolveInterEnterpriseContext(
        referenceIdForInterEnterprise,
        dto.documentType,
        currentEnterpriseId,
        userEnterpriseId,
      );

      // Статус по умолчанию:
      // - saveOnly (кнопка «Саклаш»): всегда OPEN — черновик без проводки и без автоприёма
      // - Для межпредприятийных документов всегда PENDING (подтверждение через acceptInterEnterpriseDocument)
      // - Для внутренних документов:
      //   - GateIncome остаётся как раньше (используем переданный статус или OPEN)
      //   - ComeProduct и ComeMaterial создаются сразу со статусом PROVEDEN и автоматически проводятся
      //   - Для всех остальных используем переданный статус, а если он не задан — PENDING
      //   - MoveCash с hasBuxgalter === true также создается со статусом PENDING, но утверждает его сам получатель (не HEADGLOBAL)
      let initialStatus: DocSTATUS;
      if (dto.saveOnly) {
        initialStatus = DocSTATUS.OPEN;
      } else if (interContext.isInterEnterprise) {
        initialStatus = DocSTATUS.PENDING;
      } else if (dto.documentType === DocumentType.Advance) {
        initialStatus = DocSTATUS.OPEN;
      } else if (dto.documentType === DocumentType.GateIncome) {
        initialStatus = dto.docStatus ?? DocSTATUS.OPEN;
      } else if (
        dto.documentType === DocumentType.ComeProduct ||
        dto.documentType === DocumentType.ComeMaterial ||
        dto.documentType === DocumentType.ComeTools ||
        dto.documentType === DocumentType.ComeTovar ||
        dto.documentType === DocumentType.ComeOS
      ) {
        initialStatus = dto.docStatus ?? DocSTATUS.PROVEDEN;
      } else {
        // При единственной организации или AVTO_PROVODKA_IN_MANY_ENTERPRISE_MODE внутренние документы
        // проводятся сразу без утверждения HEADGLOBAL.
        // Не доверяем dto.docStatus с клиента — иначе PENDING обходит автопроводку при рассинхроне фронта и .env.
        // Исключение: saveOnly выше — явный черновик без проводки.
        if (this.shouldAutoProveInternalDocs()) {
          initialStatus = DocSTATUS.PROVEDEN;
        } else {
          initialStatus = dto.docStatus ?? DocSTATUS.PENDING;
        }
      }

      const document = await this.documentRepository.create(
        {
          date: dto.date,
          documentType: dto.documentType,
          docStatus: initialStatus,
          userId: authorUserId,
          enterpriseId: interContext.isInterEnterprise
            ? null
            : currentEnterpriseId,
          isInterEnterprise: interContext.isInterEnterprise,
          sourceEnterpriseId: interContext.isInterEnterprise
            ? interContext.sourceEnterpriseId
            : null,
          targetEnterpriseId: interContext.isInterEnterprise
            ? interContext.targetEnterpriseId
            : null,
          documentTypeForSender: interContext.isInterEnterprise
            ? interContext.documentTypeForSender
            : null,
          documentTypeForReceiver: interContext.isInterEnterprise
            ? interContext.documentTypeForReceiver
            : null,
          isLocked: false,
          rejectionReason: null,
        },
        { transaction },
      );

      // Сохраняем receiverId для проверки автоматического приема после коммита транзакции
      const receiverIdForAutoAccept = interContext.isInterEnterprise
        ? referenceIdForInterEnterprise
        : null;

      const docValuesPayload = this.normalizeDocValuesPayload(dto.docValues);

      // Для GateIncome устанавливаем дефолтные значения senderId и receiverId если они не указаны
      let finalSenderId = docValuesPayload.senderId;
      let finalReceiverId = docValuesPayload.receiverId;

      if (dto.documentType === DocumentType.GateIncome) {
        // Для GateIncome используем дефолтное хранилище если значения не указаны
        // Используем commonStorageId из настроек или дефолтное значение
        if (!finalSenderId || finalSenderId === 0) {
          const commonStorageId =
            await this.settingsService.getSettingByKey("commonStorageId");
          finalSenderId = commonStorageId ? Number(commonStorageId) : 20125; // Дефолтное хранилище
        }
        if (!finalReceiverId || finalReceiverId === 0) {
          const commonStorageId =
            await this.settingsService.getSettingByKey("commonStorageId");
          finalReceiverId = commonStorageId ? Number(commonStorageId) : 20125; // Дефолтное хранилище
        }
      }

      const createPayload: any = {
        ...docValuesPayload,
        docId: BigInt(document.id),
        senderId: finalSenderId,
        receiverId: finalReceiverId,
        productForChargeId: docValuesPayload.productForChargeId ?? 0,
        finPerson: (docValuesPayload.finPerson as string | undefined) ?? "",
        driver: (docValuesPayload.driver as string | undefined) ?? "",
        carId: docValuesPayload.carId ?? 0,
        senderPersonId: docValuesPayload.senderPersonId ?? 0,
      };

      if (
        dto.documentType === DocumentType.LeaveMaterial ||
        dto.documentType === DocumentType.TransferToolsToClient
      ) {
        if (dto.docValues?.materialResponsiblePersonId !== undefined) {
          createPayload.materialResponsiblePersonId =
            dto.docValues.materialResponsiblePersonId || null;
        }
      }

      await this.docValuesRepository.create(createPayload, { transaction });

      const items =
        dto.docTableItems && Array.isArray(dto.docTableItems)
          ? [...dto.docTableItems]
          : [];

      // Очищаем элементы от служебных полей и undefined значений
      const itemsToSave = items.map((item) => {
        // Удаляем служебные поля, которые не должны передаваться при создании
        const { id, docId, createdAt, updatedAt, comment, ...cleanItem } =
          item as any;

        // Заменяем undefined на null или удаляем для опциональных полей
        const cleaned: any = {};
        Object.keys(cleanItem).forEach((key) => {
          const value = cleanItem[key];
          if (value !== undefined) {
            cleaned[key] = value;
          }
        });

        // Устанавливаем обязательные поля с дефолтными значениями, если они undefined
        cleaned.docId = document.id;
        cleaned.analiticId = cleaned.analiticId ?? 0;
        cleaned.balance = cleaned.balance ?? 0;
        cleaned.count = cleaned.count ?? 0;
        cleaned.price = cleaned.price ?? 0;
        cleaned.total = cleaned.total ?? 0;
        cleaned.costPrice = cleaned.costPrice ?? 0;
        cleaned.costTotal = cleaned.costTotal ?? 0;

        return cleaned;
      });

      this.assertReceiveToolsDiscountValid(dto.documentType, itemsToSave);

      if (itemsToSave.length > 0) {
        await Promise.all(
          itemsToSave.map((item) =>
            this.docTableItemsRepository.create(item, { transaction }),
          ),
        );
      }

      if (dto.documentType === DocumentType.Advance && !dto.saveOnly) {
        const advanceDoc = await this.documentRepository.findOne({
          where: { id: document.id },
          include: [DocValues, DocTableItems],
          transaction,
        });
        if (!advanceDoc) {
          throw new Error("Document not found after creation");
        }
        await this.applyAdvanceOnSave(advanceDoc, transaction);
      }

      // Проводки для межпредприятийных документов создаются только при принятии через acceptInterEnterpriseDocument
      // Используем interContext.isInterEnterprise для проверки, так как он уже вычислен и надежен
      // Для внутренних документов проводки теперь создаются:
      //   - либо через ручной вызов setProvodka (как и раньше, для OPEN документов),
      //   - либо через новый approveInternalDocument (для PENDING документов и роли HEADGLOBAL).
      // Здесь оставляем автопроводку только для особых случаев, если документ уже PROVEDEN
      // и не является межпредприятием (обратная совместимость на случай прямых вызовов API).
      if (
        document.docStatus === DocSTATUS.PROVEDEN &&
        !interContext.isInterEnterprise
      ) {
        const doc = await this.documentRepository.findOne({
          where: { id: document.id },
          include: [DocValues, DocTableItems],
          transaction,
        });

        if (!doc) {
          throw new Error("Document not found after creation");
        }

        const enterpriseId = doc.enterpriseId || currentEnterpriseId || 1;
        const documentType = doc.documentType!;

        await this.ensureSubleasePartnerIdBeforeEntries(doc, transaction);

        const entrysList = await this.prepareEntriesForEnterprise(
          doc,
          enterpriseId,
          documentType,
          false, // isGlobalDocument
          true, // isSender
          transaction,
        );

        if (
          entrysList.length > 0 &&
          (documentType === DocumentType.TransferToolsToClient ||
            documentType === DocumentType.LeaveCash)
        ) {
          mediatorTelegramPayload = { doc, entries: entrysList };
        }

        const existingEntries = await this.entryRepository.findAll({
          where: { docId: document.id },
          transaction,
        });
        if (existingEntries.length > 0) {
          throw new Error(
            `Документ ${document.id} уже имеет проводки — возможное дублирование при создании`,
          );
        }

        const hasFilledTableRows = (doc.docTableItems ?? []).some(
          (row) => Number(row.analiticId) > 0,
        );

        if (entrysList.length > 0) {
          await this.applyRentalBatchBeforeEntries(doc, transaction);

          for (const item of entrysList) {
            const { targetEnterpriseId, ...entryData } =
              item as EntryCreationAttrs & {
                targetEnterpriseId?: number | null;
              };
            const entryEnterpriseId = targetEnterpriseId ?? enterpriseId;
            const entry = await this.entryRepository.create(
              { ...entryData, enterpriseId: entryEnterpriseId },
              { transaction },
            );
            if (!entry) {
              throw new Error("Failed to create entry");
            }

            const stockEntries = await this.stocksService.addTwoEntries(
              entry,
              transaction,
            );
            if (stockEntries === undefined) {
              throw new Error("Failed to add stock entries");
            }

            const tmzEntry = await this.stocksService.addEntrieToTMZ(
              entry,
              transaction,
            );
            if (tmzEntry === undefined) {
              throw new Error("Failed to add TMZ entry");
            }

            const oborotEntry = await this.oborotsService.addEntry(
              entry,
              transaction,
            );
            if (!oborotEntry) {
              throw new Error("Failed to add oborot entry");
            }
          }
        } else if (
          hasFilledTableRows &&
          documentType !== DocumentType.OrderToolsToClient
        ) {
          throw new Error(
            "Не удалось сформировать проводки по табличной части. Проверьте строки: выбрано ОС, количество и сумма.",
          );
        }

        await this.applyRentalBatchAfterEntries(doc, transaction);

        await doc.update({ docStatus: DocSTATUS.PROVEDEN }, { transaction });
      }

      // Сохраняем данные для автоматического приема после коммита транзакции
      const shouldAutoAccept =
        interContext.isInterEnterprise &&
        initialStatus === DocSTATUS.PENDING &&
        receiverIdForAutoAccept &&
        interContext.targetEnterpriseId;

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      if (mediatorTelegramPayload) {
        this.notifyMediatorTelegramAsync(
          mediatorTelegramPayload.doc,
          mediatorTelegramPayload.entries,
        );
      }
      if (document.docStatus === DocSTATUS.PROVEDEN) {
        const docForNotify = await this.documentRepository.findOne({
          where: { id: document.id },
          include: [DocValues, DocTableItems],
        });
        if (docForNotify) {
          this.maybeNotifyRentalClient(docForNotify);
          this.notifyWorkerSalaryTelegramPostedAsync(docForNotify);
        }
      }

      // Если документ межпредприятийный и создан со статусом PENDING, проверяем флаг автоматического приема
      if (shouldAutoAccept) {
        const receiverReference = await refSer.getReferenceById(
          receiverIdForAutoAccept,
        );

        if (receiverReference?.refValues?.autoAcceptInterEnterprise) {
          const documentId = Number(document.id);

          // Небольшая задержка, чтобы убедиться, что транзакция полностью закоммичена
          await new Promise((resolve) => setTimeout(resolve, 100));

          try {
            const acceptedDocument = await this.acceptInterEnterpriseDocument(
              documentId,
              interContext.targetEnterpriseId!,
              undefined,
            );
            // Возвращаем обновленный документ
            return acceptedDocument;
          } catch (acceptError) {
            // Не пробрасываем ошибку, чтобы документ все равно был создан
            // Пользователь сможет принять его вручную позже
          }
        }
      }

      return document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  // Обновлённая функция markToDeleteById с транзакциями
  async markToDeleteById(
    id: number,
    bot?: TelegramBot,
    userId?: number,
    reopen = false,
  ) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });
    if (!transaction) {
      throw new Error("Failed to create transaction");
    }
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (
        document.documentType === DocumentType.OrderToolsToClient &&
        document.docStatus === DocSTATUS.PROVEDEN
      ) {
        const orderValues = await this.docValuesRepository.findOne({
          where: { docId: document.id },
          transaction,
        });
        const fulfilledBy = Number(orderValues?.fulfilledByTransferDocId) || 0;
        if (fulfilledBy > 0) {
          throw new BadRequestException(
            "Буюртма Топшириш билан ёпилган. Аввал Топширишни бекор қилинг",
          );
        }
        const linked = await this.findLinkedTransferForOrder(
          Number(document.id),
          transaction,
        );
        if (linked) {
          throw new BadRequestException(
            `Бу буюртма бўйича Топшириш бор (№ ${linked.id}). Аввал уни бекор қилинг`,
          );
        }
      }

      if (
        document.isInterEnterprise &&
        document.docStatus == DocSTATUS.PROVEDEN
      ) {
        throw new Error(
          "Use dedicated inter-enterprise actions instead of markToDelete",
        );
      }

      let salaryCancelPayload: {
        doc: Document;
        entries: EntryCreationAttrs[];
      } | null = null;

      // Для документов со статусом PROVEDEN — HEADCOMPANY, GLAVBUX, HEADGLOBAL, ADMINGLOBAL
      // (+ ZAVSKLAD для складских списаний LeaveMaterial / LeaveHalfstuff / LeaveOnlyOneMaterial)
      if (document.docStatus === DocSTATUS.PROVEDEN) {
        const provedenDeleteRoles = [
          UserRoles.HEADCOMPANY,
          UserRoles.GLAVBUX,
          UserRoles.HEADGLOBAL,
          UserRoles.ADMINGLOBAL,
        ];
        if (userId) {
          const user = await this.usersService.getUserById(userId);
          const zavskladOk =
            user?.role === UserRoles.ZAVSKLAD &&
            isZavskladEditableDocumentType(document.documentType);
          if (
            !user ||
            (!provedenDeleteRoles.includes(user.role) && !zavskladOk)
          ) {
            throw new Error(
              "Only HEADCOMPANY, GLAVBUX, HEADGLOBAL, ADMINGLOBAL or ZAVSKLAD (warehouse writeoffs) can delete PROVEDEN documents",
            );
          }
        } else {
          throw new Error(
            "User information is required to delete PROVEDEN documents",
          );
        }
      }

      let newStatus: DocSTATUS = document.docStatus;
      if (document.docStatus === DocSTATUS.DELETED) {
        newStatus = DocSTATUS.OPEN;
        await document.update(
          {
            docStatus: newStatus,
            isLocked: false, // Разблокируем при восстановлении
          },
          { transaction },
        );
      } else if (document.docStatus === DocSTATUS.PENDING) {
        // При delete PENDING документа переводим в OPEN для редактирования
        const pendingEntries = await this.entryRepository.findAll({
          where: { docId: document.id },
          transaction,
        });
        if (pendingEntries.length > 0) {
          throw new Error(
            `PENDING-документ ${id} содержит ${pendingEntries.length} неожиданных проводок. ` +
              `Используйте отмену проводки вместо удаления.`,
          );
        }
        newStatus = DocSTATUS.OPEN;
        await document.update(
          {
            docStatus: newStatus,
            isLocked: false, // Разблокируем для редактирования
          },
          { transaction },
        );
      } else if (document.docStatus === DocSTATUS.OPEN) {
        if (document.documentType === DocumentType.Advance) {
          await this.reverseEntries(document.id, transaction);
          const advanceValues = await this.docValuesRepository.findOne({
            where: { docId: document.id },
            transaction,
          });
          if (advanceValues) {
            await advanceValues.update(
              { advancePhase: ADVANCE_PHASE.DRAFT },
              { transaction },
            );
          }
        }
        newStatus = DocSTATUS.DELETED;
        await document.update({ docStatus: newStatus }, { transaction });
      } else if (document.docStatus === DocSTATUS.PROVEDEN) {
        newStatus = reopen ? DocSTATUS.OPEN : DocSTATUS.DELETED;

        const entrysList = await this.entryRepository.findAll({
          where: { docId: document.id },
          transaction,
        });
        if (entrysList.length > 0) {
          if (reopen) {
            const documentWithDocValues = await this.documentRepository.findOne(
              {
                where: { id: document.id },
                include: [DocValues],
                transaction,
              },
            );
            if (documentWithDocValues) {
              salaryCancelPayload = {
                doc: documentWithDocValues,
                entries: entrysList.map(
                  (entry) => entry.dataValues as EntryCreationAttrs,
                ),
              };
            }
          }

          for (const entry of entrysList) {
            await this.stocksService.deleteTwoEntries(entry, transaction);
            await this.stocksService.deleteEntrieToTMZ(entry, transaction);
            await this.oborotsService.deleteEntry(entry, transaction);
          }
          // После удаления остатков удаляем сами проводки

          const deletedRows = await this.entryRepository.destroy({
            where: { docId: document.id },
            transaction,
          });
          // Проверяем, что все проводки удалены
          const entriesLeft = await this.entryRepository.findAll({
            where: { docId: document.id },
            transaction,
          });
          if (entriesLeft.length > 0) {
            throw new Error(
              `Not all entries were deleted for document with id ${id}`,
            );
          }
        }

        await this.applyRentalBatchUnposting(document, transaction);

        if (document.documentType === DocumentType.Advance) {
          const advanceValues = await this.docValuesRepository.findOne({
            where: { docId: document.id },
            transaction,
          });
          if (advanceValues) {
            await advanceValues.update(
              { advancePhase: ADVANCE_PHASE.DRAFT },
              { transaction },
            );
          }
        }

        await document.update(
          {
            docStatus: newStatus,
            isLocked: false, // Разблокируем при удалении проводок
          },
          { transaction },
        );
      }

      // Проверяем, обновился ли статус (опционально)
      await document.reload({ transaction });
      if (document.docStatus !== newStatus) {
        throw new Error(
          `Failed to update document status for document with id ${id}`,
        );
      }

      await this.stocksService.flushPendingRemains(transaction);
      if (newStatus === DocSTATUS.DELETED) {
        await ClientContractItemLine.update(
          { saleDocId: null } as any,
          { where: { saleDocId: id }, transaction },
        );
        await ClientContractOrderLine.update(
          { saleDocId: null } as any,
          { where: { saleDocId: id }, transaction },
        );
      }
      await transaction.commit();

      if (salaryCancelPayload) {
        this.notifyWorkerSalaryTelegramCancelledAsync(
          salaryCancelPayload.doc,
          salaryCancelPayload.entries,
        );
      }

      return document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to mark document for deletion: ${error.message}`);
    }
  }

  async deleteDocumentPermanentById(id: number, userId?: number) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });
    try {
      // ВАЖНО: не используем include при FOR UPDATE, чтобы избежать ошибки
      // "FOR UPDATE не может применяться к NULL-содержащей стороне внешнего соединения".
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (document.isInterEnterprise) {
        throw new Error(
          "Inter-enterprise documents cannot be permanently deleted",
        );
      }

      if (document.docStatus !== DocSTATUS.DELETED) {
        throw new Error(
          "Only documents marked as DELETED can be permanently deleted",
        );
      }

      if (!userId) {
        throw new Error("User information is required to delete document");
      }

      const user = await this.usersService.getUserById(userId);
      const canDeleteByRole =
        user?.role === UserRoles.ADMINGLOBAL ||
        user?.role === UserRoles.HEADCOMPANY ||
        user?.role === UserRoles.KASSIRGLOBAL ||
        user?.role === UserRoles.KASSIR ||
        user?.role === UserRoles.GLAVBUX ||
        user?.role === UserRoles.HEADGLOBAL;
      const canDeleteAsAuthor = Number(document.userId) === Number(userId);

      if (!canDeleteByRole && !canDeleteAsAuthor) {
        throw new Error("No permission to permanently delete this document");
      }

      const linkedEntries = await this.entryRepository.count({
        where: { docId: document.id },
        transaction,
      });
      if (linkedEntries > 0) {
        throw new Error(
          `Document has ${linkedEntries} linked entries. Cancel provodka first.`,
        );
      }

      await this.docTableItemsRepository.destroy({
        where: { docId: document.id },
        transaction,
      });
      await this.docValuesRepository.destroy({
        where: { docId: document.id },
        transaction,
      });
      await this.documentRepository.destroy({
        where: { id: document.id },
        transaction,
      });

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      return { success: true, id: document.id };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to permanently delete document: ${error.message}`);
    }
  }

  // Обновлённая функция setProvodka с транзакциями
  async setProvodka(id: number) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE, // Блокировка на таблице documents
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      // Перепроверяем межпредприятийный статус, так как он мог быть неправильно определен при создании
      const documentWithRelations = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues, DocTableItems],
        transaction,
      });

      const sourceEnterpriseId =
        document.sourceEnterpriseId ?? document.enterpriseId ?? null;

      // Получаем user.enterpriseId для проверки межпредприятийности
      const user = document.userId
        ? await this.usersService.getUserById(document.userId)
        : null;
      const userEnterpriseId = user?.enterpriseId ?? null;

      if (
        document.documentType === DocumentType.Advance &&
        documentWithRelations
      ) {
        await this.applyAdvanceOnSave(documentWithRelations, transaction);
        await this.stocksService.flushPendingRemains(transaction);
        await transaction.commit();
        return documentWithRelations;
      }

      if (documentWithRelations && documentWithRelations.docValues) {
        const referenceIdForInterEnterprise =
          document.documentType === DocumentType.Advance
            ? null
            : documentWithRelations.docValues.receiverId;

        const interContext = await this.resolveInterEnterpriseContext(
          referenceIdForInterEnterprise,
          document.documentType,
          sourceEnterpriseId ?? undefined,
          userEnterpriseId,
        );

        if (interContext.isInterEnterprise) {
          // Обновляем документ, чтобы он стал межпредприятийным
          await document.update(
            {
              isInterEnterprise: true,
              enterpriseId: null, // Для межпредприятийных документов enterpriseId = null
              sourceEnterpriseId: interContext.sourceEnterpriseId,
              targetEnterpriseId: interContext.targetEnterpriseId,
              documentTypeForSender: interContext.documentTypeForSender,
              documentTypeForReceiver: interContext.documentTypeForReceiver,
              docStatus: DocSTATUS.PENDING,
            },
            { transaction },
          );

          throw new Error(
            "Document is inter-enterprise. Use inter-enterprise acceptance endpoint instead",
          );
        }
      }

      if (document.isInterEnterprise) {
        throw new Error("Use inter-enterprise acceptance endpoint instead");
      }

      if (document.docStatus === DocSTATUS.PROVEDEN) {
        throw new Error(`Document with id ${id} already has proveden status`);
      }

      // documentWithRelations уже получен выше при проверке межпредприятийного статуса
      if (!documentWithRelations) {
        throw new Error(`Document with id ${id} not found`);
      }

      const enterpriseId = sourceEnterpriseId;
      if (!enterpriseId) {
        throw new Error("Document enterpriseId is not defined");
      }
      const documentType = document.documentType!;

      if (documentType === DocumentType.AmortizasiyaOS) {
        await this.assertNoDuplicateAmortizasiyaOsMonth(
          documentWithRelations,
          enterpriseId,
          transaction,
        );
      }

      await this.ensureSubleasePartnerIdBeforeEntries(
        documentWithRelations,
        transaction,
      );

      const entrysList = await this.prepareEntriesForEnterprise(
        documentWithRelations,
        enterpriseId,
        documentType,
        false, // isGlobalDocument
        true, // isSender
        transaction,
      );

      const entries = await this.entryRepository.findAll({
        where: { docId: document.id },
        transaction,
      });
      if (entries.length > 0) {
        throw new Error(`Document with id ${id} is already has entries`);
      }

      if (entrysList.length > 0 && !entries.length) {
        await this.applyRentalBatchBeforeEntries(
          documentWithRelations,
          transaction,
        );

        for (const item of entrysList) {
          const { targetEnterpriseId, ...entryData } =
            item as EntryCreationAttrs & { targetEnterpriseId?: number | null };
          const entryEnterpriseId = targetEnterpriseId ?? enterpriseId;
          const entry = await this.entryRepository.create(
            { ...entryData, enterpriseId: entryEnterpriseId },
            { transaction },
          );
          await this.stocksService.addTwoEntries(entry, transaction);
          await this.stocksService.addEntrieToTMZ(entry, transaction);
          await this.oborotsService.addEntry(entry, transaction);
        }
      }

      await this.applyRentalBatchAfterEntries(
        documentWithRelations,
        transaction,
      );

      await document.update({ docStatus: DocSTATUS.PROVEDEN }, { transaction });

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      if (
        entrysList.length > 0 &&
        (documentType === DocumentType.TransferToolsToClient ||
          documentType === DocumentType.LeaveCash)
      ) {
        this.notifyMediatorTelegramAsync(documentWithRelations, entrysList);
      }
      this.maybeNotifyRentalClient(documentWithRelations);
      this.notifyWorkerSalaryTelegramPostedAsync(
        documentWithRelations,
        entrysList,
      );
      return document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to set provodka: ${error.message}`);
    }
  }

  /**
   * Утверждение внутреннего документа (не межпредприятийного) с созданием проводок.
   * Предполагается вызов от имени HEADGLOBAL (через контроллер с проверкой ролей).
   */
  async approveInternalDocument(id: number, userId?: number) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (document.isInterEnterprise) {
        throw new Error(
          "approveInternalDocument can be used only for internal documents",
        );
      }

      if (
        document.docStatus !== DocSTATUS.PENDING &&
        document.docStatus !== DocSTATUS.OPEN
      ) {
        throw new Error(
          "Only OPEN or PENDING internal documents can be approved",
        );
      }

      // Дополнительная валидация роли пользователя (HEADGLOBAL) оставляем на уровне контроллера,
      // здесь только базовая проверка наличия пользователя
      if (!userId) {
        throw new Error("User id is required to approve internal document");
      }

      const documentWithRelations = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues, DocTableItems],
        transaction,
      });

      if (!documentWithRelations) {
        throw new Error(`Document with id ${id} not found`);
      }

      const enterpriseId = document.enterpriseId;
      if (!enterpriseId) {
        throw new Error(
          "Document enterpriseId is not defined for internal document",
        );
      }

      const documentType = document.documentType!;

      // Перед созданием новых проводок убеждаемся, что их еще нет
      const existingEntries = await this.entryRepository.findAll({
        where: { docId: document.id },
        transaction,
      });

      if (existingEntries.length > 0) {
        throw new Error(`Document with id ${id} already has entries`);
      }

      await this.ensureSubleasePartnerIdBeforeEntries(
        documentWithRelations,
        transaction,
      );

      const entrysList = await this.prepareEntriesForEnterprise(
        documentWithRelations,
        enterpriseId,
        documentType,
        false, // isGlobalDocument
        true, // isSender
        transaction,
      );

      if (entrysList.length > 0) {
        await this.applyRentalBatchBeforeEntries(
          documentWithRelations,
          transaction,
        );

        for (const item of entrysList) {
          const { targetEnterpriseId, ...entryData } =
            item as EntryCreationAttrs & { targetEnterpriseId?: number | null };
          const entryEnterpriseId = targetEnterpriseId ?? enterpriseId;
          const entry = await this.entryRepository.create(
            { ...entryData, enterpriseId: entryEnterpriseId },
            { transaction },
          );

          await this.stocksService.addTwoEntries(entry, transaction);
          await this.stocksService.addEntrieToTMZ(entry, transaction);
          await this.oborotsService.addEntry(entry, transaction);
        }
      }

      await this.applyRentalBatchAfterEntries(
        documentWithRelations,
        transaction,
      );

      await document.update(
        {
          docStatus: DocSTATUS.PROVEDEN,
          isLocked: true,
          rejectionReason: null,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      if (
        entrysList.length > 0 &&
        (documentType === DocumentType.TransferToolsToClient ||
          documentType === DocumentType.LeaveCash)
      ) {
        this.notifyMediatorTelegramAsync(documentWithRelations, entrysList);
      }
      this.maybeNotifyRentalClient(documentWithRelations);
      this.notifyWorkerSalaryTelegramPostedAsync(
        documentWithRelations,
        entrysList,
      );
      return document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to approve internal document: ${error.message}`);
    }
  }

  async sendInterEnterpriseDocument(id: number, enterpriseId: number) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction();
    try {
      // Сначала блокируем документ без includes, чтобы избежать ошибки FOR UPDATE на NULL стороне внешнего соединения
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.isLocked) {
        throw new Error("Document is locked");
      }

      if (document.docStatus !== DocSTATUS.OPEN) {
        throw new Error("Only OPEN documents can be sent");
      }

      if (document.sourceEnterpriseId !== enterpriseId) {
        throw new Error("No permission to send this document");
      }

      // Загружаем DocValues отдельно (без блокировки, так как основной документ уже заблокирован)
      const documentWithDocValues = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues],
        transaction,
      });

      await document.update(
        {
          docStatus: DocSTATUS.PENDING,
          rejectionReason: null,
        },
        { transaction },
      );

      // Сохраняем receiverId и targetEnterpriseId до коммита транзакции
      const receiverId = documentWithDocValues?.docValues?.receiverId;
      const targetEnterpriseId = document.targetEnterpriseId;

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      // Проверяем, есть ли у receiver флаг автоматического приема (после коммита транзакции)
      if (receiverId && targetEnterpriseId) {
        const receiverReference =
          await this.referencesService.getReferenceById(receiverId);

        if (receiverReference?.refValues?.autoAcceptInterEnterprise) {
          // Если у receiver есть флаг автоматического приема, автоматически принимаем документ
          // Используем targetEnterpriseId как enterpriseId для принятия
          // userId передаем как undefined для автоматического принятия (пропускаем проверку разрешенных storages)

          // Небольшая задержка, чтобы убедиться, что транзакция полностью закоммичена и документ обновлен в БД
          await new Promise((resolve) => setTimeout(resolve, 100));

          try {
            await this.acceptInterEnterpriseDocument(
              id,
              targetEnterpriseId,
              undefined,
            );
          } catch (acceptError) {
            // Пробрасываем ошибку дальше, чтобы пользователь знал о проблеме
            throw new Error(
              `Не удалось автоматически принять документ: ${acceptError?.message || acceptError}`,
            );
          }
        }
      }

      return document;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async sendInternalDocumentToPending(id: number, enterpriseId: number) {
    const documentUnlocked = await this.documentRepository.findOne({
      where: { id },
    });

    if (!documentUnlocked) {
      throw new Error(`Document with id ${id} not found`);
    }

    await this.assertDocumentDateEditable(documentUnlocked.date);

    if (documentUnlocked.isInterEnterprise) {
      throw new Error(
        "Document is inter-enterprise, use sendInterEnterpriseDocument instead",
      );
    }

    if (documentUnlocked.isLocked) {
      throw new Error("Document is locked");
    }

    if (documentUnlocked.docStatus !== DocSTATUS.OPEN) {
      throw new Error("Only OPEN documents can be sent to PENDING");
    }

    if (documentUnlocked.enterpriseId !== enterpriseId) {
      throw new Error("No permission to send this document to PENDING");
    }

    if (this.shouldAutoProveInternalDocs()) {
      return this.setProvodka(id);
    }

    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (
        document.isInterEnterprise ||
        document.isLocked ||
        document.docStatus !== DocSTATUS.OPEN ||
        document.enterpriseId !== enterpriseId
      ) {
        throw new Error("Document state changed; cannot send to PENDING");
      }

      await document.update(
        {
          docStatus: DocSTATUS.PENDING,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      return document;
    } catch (error) {
      await transaction.rollback();
      throw new Error(
        `Failed to send internal document to PENDING: ${error.message}`,
      );
    }
  }

  async cancelInterEnterpriseSending(
    id: number,
    enterpriseId: number,
    userId?: number,
  ) {
    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.docStatus !== DocSTATUS.PENDING) {
        throw new Error("Only PENDING documents can be cancelled");
      }

      // Проверяем права: отправитель или HEADGLOBAL
      const isSender = document.sourceEnterpriseId === enterpriseId;
      let isHeadGlobal = false;

      if (userId) {
        const user = await this.usersService.getUserById(userId);
        isHeadGlobal = user?.role === UserRoles.HEADGLOBAL;
      }

      if (!isSender && !isHeadGlobal) {
        throw new Error("No permission to cancel sending");
      }

      await document.update(
        {
          docStatus: DocSTATUS.OPEN,
          rejectionReason: null,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      return document;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async acceptInterEnterpriseDocument(
    id: number,
    enterpriseId: number,
    userId?: number,
  ) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction();
    try {
      // Сначала блокируем документ без includes, чтобы избежать ошибки FOR UPDATE на NULL стороне внешнего соединения
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      // Затем загружаем связанные данные отдельно (без блокировки, так как основной документ уже заблокирован)
      const documentWithRelations = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues, DocTableItems],
        transaction,
      });

      if (!documentWithRelations) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.docStatus !== DocSTATUS.PENDING) {
        throw new Error("Only PENDING documents can be accepted");
      }

      if (document.isLocked) {
        throw new Error("Document is locked");
      }

      // Проверка разрешенных storages для пользователя
      let isHeadGlobalAccepting = false;
      let allowedEnterpriseIds: Set<number> | null = null;

      if (userId) {
        const user = await this.usersService.getUserById(userId);
        if (user) {
          // ADMINGLOBAL может принимать все документы без проверки разрешенных storages
          if (user.role === UserRoles.ADMINGLOBAL) {
            // Пропускаем проверку для ADMINGLOBAL
          } else if (user.role === UserRoles.HEADGLOBAL) {
            // HEADGLOBAL может принимать документы от имени других организаций
            // но только в пределах разрешённых складов и их предприятий

            // Проверяем, что allowedStorageIds задан и не пустой
            if (
              !user.allowedStorageIds ||
              !Array.isArray(user.allowedStorageIds) ||
              user.allowedStorageIds.length === 0
            ) {
              throw new Error(
                "HEADGLOBAL фойдаланувчи учун рухсат берилган омборхоналар кўрсатилмаган. Ушбу хужжатни кабул килиш мумкин эмас.",
              );
            }

            // Вычисляем разрешённые enterpriseId из разрешённых складов
            // Используем getAllReferencesFromBase для гарантии наличия refValues
            const allReferences =
              await this.referencesService.getAllReferencesFromBase();
            allowedEnterpriseIds = new Set<number>();

            for (const storageId of user.allowedStorageIds) {
              const storageRef = allReferences.find(
                (ref) =>
                  ref.id === storageId &&
                  ref.typeReference === TypeReference.STORAGES,
              );

              if (storageRef) {
                // Используем enterpriseId справочника (организация склада)
                if (
                  storageRef.enterpriseId !== null &&
                  storageRef.enterpriseId !== undefined
                ) {
                  allowedEnterpriseIds.add(storageRef.enterpriseId);
                }
              }
            }

            // Логируем для отладки
            this.logger.debug(
              `[HEADGLOBAL] Разрешённые enterpriseId: ${Array.from(allowedEnterpriseIds).join(", ")}, targetEnterpriseId документа: ${document.targetEnterpriseId}`,
            );

            // Проверяем, что targetEnterpriseId документа входит в разрешённые предприятия
            if (!allowedEnterpriseIds.has(document.targetEnterpriseId!)) {
              const allowedIdsStr = Array.from(allowedEnterpriseIds).join(", ");
              throw new Error(
                `HEADGLOBAL фойдаланувчи учун ушбу ташкилот учун рухсат берилмаган. Хужжатни кабул килиш мумкин эмас. Рухсат берилган ташкилотлар: ${allowedIdsStr || "йук"}, Хужжат ташкилоти: ${document.targetEnterpriseId}`,
              );
            }

            // Проверяем receiverId (склад получателя) - он должен быть в allowedStorageIds
            const receiverId = documentWithRelations.docValues?.receiverId;
            if (receiverId) {
              const receiverReference =
                await this.referencesService.getReferenceById(receiverId);

              if (
                receiverReference &&
                receiverReference.typeReference === TypeReference.STORAGES
              ) {
                if (!user.allowedStorageIds.includes(receiverId)) {
                  throw new Error(
                    `Сиз ушбу худдатни кабул килишга имконингиз йук ${receiverId}`,
                  );
                }
              }
            }

            isHeadGlobalAccepting = true;
          } else {
            const receiverId = documentWithRelations.docValues?.receiverId;

            if (receiverId) {
              // Проверяем, что receiverId является STORAGES типом
              const receiverReference =
                await this.referencesService.getReferenceById(receiverId);

              if (
                receiverReference &&
                receiverReference.typeReference === TypeReference.STORAGES
              ) {
                // Если у пользователя не заданы разрешенные storages, запрещаем принятие документов
                if (
                  !user.allowedStorageIds ||
                  !Array.isArray(user.allowedStorageIds) ||
                  user.allowedStorageIds.length === 0
                ) {
                  throw new Error(
                    "Фойдаланувчи ушбу хужжатни кабул килишга хукуки йук.",
                  );
                }

                // Проверяем, что receiverId находится в списке разрешенных storages пользователя
                if (!user.allowedStorageIds.includes(receiverId)) {
                  throw new Error(
                    `Сиз ушбу худдатни кабул килишга имконингиз йук ${receiverId}`,
                  );
                }
              }
            }
          }
        }
      }

      // Проверка прав на принятие документа
      // Для HEADGLOBAL разрешаем, если targetEnterpriseId входит в разрешённые предприятия
      // Для остальных - только если targetEnterpriseId совпадает с enterpriseId пользователя
      if (isHeadGlobalAccepting && allowedEnterpriseIds) {
        // Проверка уже выполнена выше
      } else if (document.targetEnterpriseId !== enterpriseId) {
        throw new Error("No permission to accept this document");
      }

      // Валидация ZpCalculate с targetEnterpriseId: receiverId и analiticId должны относиться к целевой организации
      if (
        document.documentType === DocumentType.ZpCalculate &&
        document.targetEnterpriseId &&
        documentWithRelations.docValues
      ) {
        const receiverId = documentWithRelations.docValues.receiverId;
        const analiticId = documentWithRelations.docValues.analiticId;
        const expectedEnterpriseId = Number(document.targetEnterpriseId);
        if (receiverId) {
          const receiverRef =
            await this.referencesService.getReferenceById(receiverId);
          const receiverLinked =
            receiverRef?.enterpriseId != null
              ? Number(receiverRef.enterpriseId)
              : null;
          if (
            receiverLinked === null ||
            receiverLinked !== expectedEnterpriseId
          ) {
            throw new Error(
              "receiverId не относится к целевой организации документа ZpCalculate",
            );
          }
        }
        if (analiticId) {
          const analiticRef =
            await this.referencesService.getReferenceById(analiticId);
          const analiticEnterpriseId =
            analiticRef?.enterpriseId != null
              ? Number(analiticRef.enterpriseId)
              : null;
          const analiticLinked =
            analiticRef?.enterpriseId != null
              ? Number(analiticRef.enterpriseId)
              : null;
          const analiticBelongsToExpected =
            analiticEnterpriseId === expectedEnterpriseId ||
            analiticLinked === expectedEnterpriseId;
          if (!analiticBelongsToExpected) {
            throw new Error(
              "analiticId (ходим) не относится к целевой организации документа ZpCalculate",
            );
          }
        }
      }

      // Создаем проводки для обеих сторон
      const sourceEnterpriseId = document.sourceEnterpriseId!;
      const targetEnterpriseId = document.targetEnterpriseId!;

      // Специальная логика для межпредприятийного ComeMaterial (удалённый приход)
      // Только когда сам документ создан как ComeMaterial — не создаём sender-проводки.
      // SaleProd/SaleMaterial имеют documentTypeForReceiver=ComeMaterial, но у отправителя должны быть свои проводки (SaleProd/SaleMaterial).
      const isRemoteComeMaterial =
        document.documentType === DocumentType.ComeMaterial ||
        document.documentType === DocumentType.ComeTools ||
        document.documentType === DocumentType.ComeTovar ||
        document.documentType === DocumentType.ComeOS;

      // ZpCalculate: проводки только в целевой организации (получателе), без sender-проводок
      const isZpCalculateToTarget =
        document.documentType === DocumentType.ZpCalculate &&
        document.targetEnterpriseId;

      if (isRemoteComeMaterial) {
        // Для ComeMaterial/ComeOS создаем проводки только в предприятии-получателе
        const receiverEntries = await this.prepareEntriesForEnterprise(
          documentWithRelations,
          targetEnterpriseId,
          document.documentType,
          true, // isGlobalDocument
          true, // isSender - важно для правильной проводки Дт 10 Кт 60
          transaction,
        );

        for (const entryData of receiverEntries) {
          const {
            targetEnterpriseId: entryTargetEnterpriseId,
            ...entryPayload
          } = entryData as EntryCreationAttrs & {
            targetEnterpriseId?: number | null;
          };
          const entryEnterpriseId =
            entryTargetEnterpriseId ?? targetEnterpriseId;
          const entry = await this.entryRepository.create(
            { ...entryPayload, enterpriseId: entryEnterpriseId },
            { transaction },
          );

          await this.stocksService.addTwoEntries(entry, transaction);
          await this.stocksService.addEntrieToTMZ(entry, transaction);
          await this.oborotsService.addEntry(entry, transaction);
        }
      } else if (isZpCalculateToTarget) {
        // Для ZpCalculate создаем проводки только в целевой организации
        const receiverEntries = await this.prepareEntriesForEnterprise(
          documentWithRelations,
          targetEnterpriseId,
          document.documentType,
          true, // isGlobalDocument
          true, // isSender
          transaction,
        );

        for (const entryData of receiverEntries) {
          const {
            targetEnterpriseId: entryTargetEnterpriseId,
            ...entryPayload
          } = entryData as EntryCreationAttrs & {
            targetEnterpriseId?: number | null;
          };
          const entryEnterpriseId =
            entryTargetEnterpriseId ?? targetEnterpriseId;
          const entry = await this.entryRepository.create(
            { ...entryPayload, enterpriseId: entryEnterpriseId },
            { transaction },
          );

          await this.stocksService.addTwoEntries(entry, transaction);
          await this.stocksService.addEntrieToTMZ(entry, transaction);
          await this.oborotsService.addEntry(entry, transaction);
        }
      } else {
        // Стандартная логика для остальных межпредприятийных документов
        // Проводки для отправителя (создаются всегда)
        const senderDocType =
          document.documentTypeForSender || document.documentType;

        this.logger.log(
          `[provedeDocumentById] Preparing sender entries for inter-enterprise document: ` +
            `docId=${document.id}, docType=${document.documentType}, senderDocType=${senderDocType}, ` +
            `sourceEnterpriseId=${sourceEnterpriseId}, targetEnterpriseId=${targetEnterpriseId}, ` +
            `isInterEnterprise=${document.isInterEnterprise}`,
        );

        const senderEntries = await this.prepareEntriesForEnterprise(
          documentWithRelations,
          sourceEnterpriseId,
          senderDocType,
          true, // isGlobalDocument
          true, // isSender
          transaction,
        );

        this.logger.log(
          `[provedeDocumentById] Sender entries prepared: docId=${document.id}, ` +
            `entriesCount=${senderEntries.length}`,
        );

        for (const entryData of senderEntries) {
          const {
            targetEnterpriseId: entryTargetEnterpriseId,
            ...entryPayload
          } = entryData as EntryCreationAttrs & {
            targetEnterpriseId?: number | null;
          };
          const entryEnterpriseId =
            entryTargetEnterpriseId ?? sourceEnterpriseId;
          const entry = await this.entryRepository.create(
            { ...entryPayload, enterpriseId: entryEnterpriseId },
            { transaction },
          );

          await this.stocksService.addTwoEntries(entry, transaction);
          await this.stocksService.addEntrieToTMZ(entry, transaction);
          await this.oborotsService.addEntry(entry, transaction);
        }

        await this.stocksService.flushPendingRemains(transaction);

        // Проводки для получателя (создаются только с 1 декабря 2024)
        const receiverEntriesStartDate =
          INTER_ENTERPRISE_RECEIVER_ENTRIES_START_DATE;

        if (document.date >= receiverEntriesStartDate) {
          const receiverDocType = document.documentTypeForReceiver!;

          this.logger.log(
            `[provedeDocumentById] Preparing receiver entries for inter-enterprise document: ` +
              `docId=${document.id}, receiverDocType=${receiverDocType}, ` +
              `sourceEnterpriseId=${sourceEnterpriseId}, targetEnterpriseId=${targetEnterpriseId}`,
          );

          const receiverEntries = await this.prepareEntriesForEnterprise(
            documentWithRelations,
            targetEnterpriseId,
            receiverDocType,
            true, // isGlobalDocument
            false, // isSender
            transaction,
          );

          this.logger.log(
            `[provedeDocumentById] Receiver entries prepared: docId=${document.id}, ` +
              `entriesCount=${receiverEntries.length}`,
          );

          for (const entryData of receiverEntries) {
            const {
              targetEnterpriseId: entryTargetEnterpriseId,
              ...entryPayload
            } = entryData as EntryCreationAttrs & {
              targetEnterpriseId?: number | null;
            };
            const entryEnterpriseId =
              entryTargetEnterpriseId ?? targetEnterpriseId;
            const entry = await this.entryRepository.create(
              { ...entryPayload, enterpriseId: entryEnterpriseId },
              { transaction },
            );

            await this.stocksService.addTwoEntries(entry, transaction);
            await this.stocksService.addEntrieToTMZ(entry, transaction);
            await this.oborotsService.addEntry(entry, transaction);
          }
        }
      }

      await document.update(
        {
          docStatus: DocSTATUS.PROVEDEN,
          isLocked: true,
          rejectionReason: null,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      const docForNotify = await this.documentRepository.findOne({
        where: { id: document.id },
        include: [DocValues, DocTableItems],
      });
      if (docForNotify?.docStatus === DocSTATUS.PROVEDEN) {
        this.maybeNotifyRentalClient(docForNotify);
        this.notifyWorkerSalaryTelegramPostedAsync(docForNotify);
      }

      return document;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async rejectInterEnterpriseDocument(
    id: number,
    enterpriseId: number,
    reason: string,
  ) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.docStatus !== DocSTATUS.PENDING) {
        throw new Error("Only PENDING documents can be rejected");
      }

      if (document.targetEnterpriseId !== enterpriseId) {
        throw new Error("No permission to reject this document");
      }

      await document.update(
        {
          docStatus: DocSTATUS.REJECTED,
          rejectionReason: reason,
          isLocked: false,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      return document;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async returnInterEnterpriseDocumentToWork(id: number, enterpriseId: number) {
    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.docStatus !== DocSTATUS.REJECTED) {
        throw new Error("Only REJECTED documents can be returned to work");
      }

      if (document.sourceEnterpriseId !== enterpriseId) {
        throw new Error("No permission to return this document");
      }

      await document.update(
        {
          docStatus: DocSTATUS.OPEN,
          rejectionReason: null,
          isLocked: false,
        },
        { transaction },
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();
      return document;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelInterEnterpriseProvodka(
    id: number,
    isSuperUser?: boolean,
  ) {
    if (!isSuperUser) {
      throw new Error(
        "Только ADMINGLOBAL может отменить проводки межпредприятийного документа",
      );
    }

    const existingForBan = await this.documentRepository.findByPk(id, {
      attributes: ["id", "date"],
    });
    await this.assertDocumentDateEditable(existingForBan?.date);

    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });
    try {
      // Сначала блокируем документ без includes, чтобы избежать ошибки FOR UPDATE на NULL стороне внешнего соединения
      const document = await this.documentRepository.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!document) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (!document.isInterEnterprise) {
        throw new Error("Document is not inter-enterprise");
      }

      if (document.docStatus !== DocSTATUS.PROVEDEN) {
        throw new Error(
          "Only PROVEDEN inter-enterprise documents can have their entries cancelled",
        );
      }

      // Загружаем DocValues отдельно (без блокировки, так как основной документ уже заблокирован)
      const documentWithDocValues = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues],
        transaction,
      });

      // Находим все проводки по документу (для обеих организаций)
      const entrysList = await this.entryRepository.findAll({
        where: { docId: document.id },
        transaction,
      });

      const salaryCancelledEntries = entrysList.map(
        (entry) => entry.dataValues as EntryCreationAttrs,
      );

      if (entrysList.length > 0) {
        // Отменяем все stocks и oborots для каждой проводки
        for (const entry of entrysList) {
          await this.stocksService.deleteTwoEntries(entry, transaction);
          await this.stocksService.deleteEntrieToTMZ(entry, transaction);
          await this.oborotsService.deleteEntry(entry, transaction);
        }

        // Удаляем сами проводки
        await this.entryRepository.destroy({
          where: { docId: document.id },
          transaction,
        });

        // Проверяем, что все проводки удалены
        const entriesLeft = await this.entryRepository.findAll({
          where: { docId: document.id },
          transaction,
        });

        if (entriesLeft.length > 0) {
          throw new Error(
            `Not all entries were deleted for document with id ${id}`,
          );
        }
      }

      // Логируем состояние документа до обновления
      console.log(
        `[cancelInterEnterpriseProvodka] Before update - Document ${id}: isLocked=${document.isLocked}, docStatus=${document.docStatus}`,
      );
      this.logger.log(
        `[cancelInterEnterpriseProvodka] Before update - Document ${id}: isLocked=${document.isLocked}, docStatus=${document.docStatus}`,
      );

      // Обновляем статус документа на OPEN и разблокируем
      // Это позволит отправителю изменить документ и отправить заново
      await document.update(
        {
          docStatus: DocSTATUS.OPEN,
          isLocked: false,
          rejectionReason: null,
        },
        { transaction },
      );

      // Логируем состояние документа после update (но до commit)
      console.log(
        `[cancelInterEnterpriseProvodka] After update (before commit) - Document ${id}: isLocked=${document.isLocked}, docStatus=${document.docStatus}`,
      );
      this.logger.log(
        `[cancelInterEnterpriseProvodka] After update (before commit) - Document ${id}: isLocked=${document.isLocked}, docStatus=${document.docStatus}`,
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      // Перезагружаем документ из базы данных после commit, чтобы гарантировать актуальные данные
      // Это безопасно и не влияет на другие операции, так как транзакция уже зафиксирована
      // Аналогично тому, как это сделано в recalculateSaleProdCosts
      const updatedDocument = await this.documentRepository.findOne({
        where: { id },
        include: [DocValues, DocTableItems],
      });

      if (!updatedDocument) {
        throw new Error(
          `Failed to reload document ${id} after canceling provodka`,
        );
      }

      // Логируем состояние документа после перезагрузки из базы данных
      console.log(
        `[cancelInterEnterpriseProvodka] After reload from DB - Document ${id}: isLocked=${updatedDocument.isLocked}, docStatus=${updatedDocument.docStatus}`,
      );
      this.logger.log(
        `[cancelInterEnterpriseProvodka] After reload from DB - Document ${id}: isLocked=${updatedDocument.isLocked}, docStatus=${updatedDocument.docStatus}`,
      );

      if (documentWithDocValues && salaryCancelledEntries.length > 0) {
        this.notifyWorkerSalaryTelegramCancelledAsync(
          documentWithDocValues,
          salaryCancelledEntries,
        );
      }

      return updatedDocument;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private assertReceiveToolsDiscountValid(
    documentType: DocumentType | undefined,
    items:
      | Array<{
          tableType?: string | null;
          rentSum?: number | null;
          price?: number | null;
          costPrice?: number | null;
        }>
      | null
      | undefined,
  ): void {
    if (documentType !== DocumentType.ReceiveToolsFromClient) {
      return;
    }
    const discountError = getReceiveToolsDiscountError(items);
    if (discountError) {
      throw new Error(discountError);
    }
    const salePriceError = getReceiveToolsSalePriceError(items);
    if (salePriceError) {
      throw new Error(salePriceError);
    }
  }

  private async prepareEntriesForEnterprise(
    document: Document,
    enterpriseId: number,
    documentType: DocumentType | undefined,
    isGlobalDocument: boolean,
    isSender: boolean,
    transaction: Transaction,
  ): Promise<EntryCreationAttrs[]> {
    if (!documentType) {
      throw new Error("Document type is required for preparing entries");
    }

    this.assertReceiveToolsDiscountValid(
      documentType,
      document.docTableItems,
    );

    // Создаем временный документ с нужным типом для prepareEntrysList
    const tempDoc = {
      ...document.toJSON(),
      documentType,
      enterpriseId,
    } as Document;

    // Используем стандартную логику prepareEntrysList
    // Передаем force=true, так как документ уже в статусе PROVEDEN и нам нужно создать проводки
    return await prepareEntrysList(
      tempDoc as Document,
      isGlobalDocument,
      isSender,
      this.referencesService,
      this.settingsService,
      this.stocksService,
      true,
    );
  }

  /**
   * В режиме одной организации после PATCH внутреннего документа в OPEN/PENDING
   * проводим сразу (как при создании с PROVEDEN), если проводок ещё нет.
   * GateIncome не трогаем — как при createDocument.
   */
  private async autoProveInternalDocumentAfterUpdateIfSingleEnterprise(
    documentEntity: Document,
    docWithRelations: Document,
    priorDocStatus: DocSTATUS,
    isInterEnterprise: boolean,
    enterpriseId: number,
    transaction: Transaction,
  ): Promise<boolean> {
    if (!this.shouldAutoProveInternalDocs() || isInterEnterprise) {
      return false;
    }
    if (documentEntity.documentType === DocumentType.Advance) {
      return false;
    }
    if (
      priorDocStatus !== DocSTATUS.OPEN &&
      priorDocStatus !== DocSTATUS.PENDING
    ) {
      return false;
    }
    const dt = documentEntity.documentType;
    if (!dt || dt === DocumentType.GateIncome) {
      return false;
    }

    const existingEntries = await this.entryRepository.findAll({
      where: { docId: documentEntity.id },
      transaction,
    });
    if (existingEntries.length > 0) {
      return false;
    }

    await this.ensureSubleasePartnerIdBeforeEntries(
      docWithRelations,
      transaction,
    );

    const entrysList = await this.prepareEntriesForEnterprise(
      docWithRelations,
      enterpriseId,
      dt,
      false,
      true,
      transaction,
    );

    if (entrysList.length > 0) {
      await this.applyRentalBatchBeforeEntries(docWithRelations, transaction);

      for (const item of entrysList) {
        const { targetEnterpriseId, ...entryData } =
          item as EntryCreationAttrs & {
            targetEnterpriseId?: number | null;
          };
        const entryEnterpriseId = targetEnterpriseId ?? enterpriseId;
        const entry = await this.entryRepository.create(
          { ...entryData, enterpriseId: entryEnterpriseId },
          { transaction },
        );
        if (!entry) {
          throw new Error("Failed to create entry");
        }

        const stockEntries = await this.stocksService.addTwoEntries(
          entry,
          transaction,
        );
        if (stockEntries === undefined) {
          throw new Error("Failed to add stock entries");
        }

        const tmzEntry = await this.stocksService.addEntrieToTMZ(
          entry,
          transaction,
        );
        if (tmzEntry === undefined) {
          throw new Error("Failed to add TMZ entry");
        }

        const oborotEntry = await this.oborotsService.addEntry(
          entry,
          transaction,
        );
        if (!oborotEntry) {
          throw new Error("Failed to add oborot entry");
        }
      }
    }

    await this.applyRentalBatchAfterEntries(docWithRelations, transaction);

    await documentEntity.update(
      { docStatus: DocSTATUS.PROVEDEN },
      { transaction },
    );

    if (
      entrysList.length > 0 &&
      (dt === DocumentType.TransferToolsToClient ||
        dt === DocumentType.LeaveCash)
    ) {
      this.notifyMediatorTelegramAsync(docWithRelations, entrysList);
    }
    return true;
  }

  private async ensureSubleasePartnerIdBeforeEntries(
    doc: Document,
    transaction?: Transaction,
  ): Promise<void> {
    if (
      doc.documentType !== DocumentType.TransferSubleaseToolsToClient &&
      doc.documentType !== DocumentType.ReceiveSubleaseToolsFromClient
    ) {
      return;
    }
    await this.subleaseToolBatchesService.ensurePartnerIdFromStorage(
      doc,
      transaction,
    );
  }

  private async applyRentalBatchBeforeEntries(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    if (doc.documentType === DocumentType.TransferToolsToClient) {
      await this.assertTransferFromOrderCanPost(doc, transaction);
      return;
    }
    if (doc.documentType === DocumentType.ReceiveToolsFromClient) {
      await this.clientToolBatchesService.consumeBatchesOnReceivePosted(
        doc,
        transaction,
      );
      return;
    }
    if (doc.documentType === DocumentType.ReceiveSubleaseToolsFromClient) {
      await this.subleaseToolBatchesService.consumeBatchesOnReceivePosted(
        doc,
        transaction,
      );
    }
  }

  private async applyRentalBatchAfterEntries(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    if (doc.documentType === DocumentType.TransferToolsToClient) {
      await this.clientToolBatchesService.openBatchesOnTransferPosted(
        doc,
        transaction,
      );
      await this.markOrderFulfilledByTransfer(doc, transaction);
      return;
    }
    if (doc.documentType === DocumentType.TransferSubleaseToolsToClient) {
      await this.subleaseToolBatchesService.openBatchesOnTransferPosted(
        doc,
        transaction,
      );
    }
  }

  private async applyRentalBatchUnposting(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    if (doc.documentType === DocumentType.TransferToolsToClient) {
      await this.clientToolBatchesService.reverseTransferPosting(
        Number(doc.id),
        transaction,
      );
      await this.clearOrderFulfillmentByTransfer(doc, transaction);
      return;
    }
    if (doc.documentType === DocumentType.ReceiveToolsFromClient) {
      await this.clientToolBatchesService.reverseReceivePosting(
        Number(doc.id),
        transaction,
      );
      return;
    }
    if (doc.documentType === DocumentType.TransferSubleaseToolsToClient) {
      await this.subleaseToolBatchesService.reverseTransferPosting(
        Number(doc.id),
        transaction,
      );
      return;
    }
    if (doc.documentType === DocumentType.ReceiveSubleaseToolsFromClient) {
      await this.subleaseToolBatchesService.reverseReceivePosting(
        Number(doc.id),
        transaction,
      );
    }
  }

  private async resolveInterEnterpriseContext(
    referenceId: number | null | undefined,
    documentType: DocumentType,
    sourceEnterpriseId?: number | null,
    userEnterpriseId?: number | null,
  ): Promise<{
    isInterEnterprise: boolean;
    sourceEnterpriseId: number | null;
    targetEnterpriseId: number | null;
    documentTypeForSender: DocumentType | null;
    documentTypeForReceiver: DocumentType | null;
  }> {
    if (this.configService.get("SINGLE_ENTERPRISE_MODE") === "true") {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: sourceEnterpriseId ?? null,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    const normalizedSource = sourceEnterpriseId ?? null;

    if (!referenceId) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: normalizedSource,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    const receiverReference =
      await this.referencesService.getReferenceById(referenceId);

    if (!receiverReference) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: normalizedSource,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    // SaleMaterial сотруднику (зарплата материалами) — не межпредприятие
    if (
      documentType === DocumentType.SaleMaterial &&
      receiverReference.typeReference === TypeReference.WORKERS
    ) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: normalizedSource,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    const targetEnterpriseId = receiverReference?.enterpriseId ?? null;

    // Для межпредприятийного документа проверяем наличие enterpriseId получателя
    // Если у receiver есть enterpriseId (другая организация), документ является межпредприятийным
    if (!targetEnterpriseId) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: normalizedSource,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    // Если sourceEnterpriseId не передан, но есть targetEnterpriseId,
    // используем значение по умолчанию (1) для определения межпредприятийности
    const effectiveSourceEnterpriseId = normalizedSource ?? 1;

    // Проверяем, что targetEnterpriseId отличается от user.enterpriseId
    // Документ может быть межпредприятийным только если targetEnterpriseId !== userEnterpriseId
    if (
      userEnterpriseId !== null &&
      userEnterpriseId !== undefined &&
      targetEnterpriseId === userEnterpriseId
    ) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: effectiveSourceEnterpriseId,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    // Проверяем, что это действительно разные предприятия
    if (targetEnterpriseId === effectiveSourceEnterpriseId) {
      return {
        isInterEnterprise: false,
        sourceEnterpriseId: effectiveSourceEnterpriseId,
        targetEnterpriseId: null,
        documentTypeForSender: null,
        documentTypeForReceiver: null,
      };
    }

    return {
      isInterEnterprise: true,
      sourceEnterpriseId: effectiveSourceEnterpriseId,
      targetEnterpriseId,
      documentTypeForSender: resolveSenderDocumentType(documentType),
      documentTypeForReceiver: resolveReceiverDocumentType(documentType),
    };
  }

  /**
   * Пересчитывает себестоимость (costPrice и costTotal) для документа SaleProd
   * на основе текущих данных склада
   */
  async recalculateSaleProdCosts(documentId: number): Promise<Document> {
    const transaction = await this.sequelize.transaction();
    try {
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
        include: [DocValues, DocTableItems],
        transaction,
      });

      if (!document) {
        throw new Error(`Document with id ${documentId} not found`);
      }

      if (document.documentType !== DocumentType.SaleProd) {
        throw new Error("This method is only for SaleProd documents");
      }

      // Проверяем, что документ не проведен или можно редактировать
      if (document.docStatus === DocSTATUS.PROVEDEN) {
        throw new Error(
          "Cannot recalculate costs for proveden document. Please cancel provodka first.",
        );
      }

      const warehouseId = document.docValues?.senderId;
      if (!warehouseId) {
        throw new Error("Warehouse (senderId) is not set");
      }

      // Для получения остатков на конец дня документа добавляем 1 день
      // Это гарантирует, что мы получим остатки после всех операций за день документа
      const documentDate = Number(document.date);
      const oneDay = 24 * 60 * 60 * 1000;
      const targetDateForStock = documentDate + 1; // Дата документа + 1 день

      // Определяем enterpriseId для фильтрации остатков:
      // 1. Для межпредприятийных документов используем sourceEnterpriseId (откуда идет товар)
      //    так как остатки должны браться со склада отправителя (senderId)
      // 2. Для обычных документов используем enterpriseId документа
      // 3. Если оба null, передаем undefined - не фильтруем по предприятию (получим остатки из всех предприятий)
      //    Это может быть полезно, если склад общий для нескольких предприятий
      let enterpriseIdForStock: number | null | undefined;
      if (document.isInterEnterprise) {
        // Для межпредприятийных документов остатки берутся со склада отправителя (sourceEnterpriseId)
        enterpriseIdForStock = document.sourceEnterpriseId ?? undefined;
      } else {
        // Для обычных документов используем enterpriseId документа
        enterpriseIdForStock = document.enterpriseId ?? undefined;
      }

      // Обновляем себестоимость для каждой строки табличной части
      await Promise.all(
        document.docTableItems.map(async (item, index) => {
          // Получаем данные склада для товара
          // Используем дату документа + 1 день, чтобы получить остатки на конец дня документа
          const stockData = await this.stocksService.getStockByDate(
            Schet.S28, // Счет для готовой продукции
            warehouseId,
            item.analiticId,
            targetDateForStock, // Дата документа + 1 день
            transaction,
            enterpriseIdForStock,
          );

          // Рассчитываем среднюю себестоимость
          const newCostPrice =
            stockData.remainCount > 0
              ? stockData.remainTotal / stockData.remainCount
              : item.costPrice; // Если нет остатков, оставляем старую

          const newCostTotal = newCostPrice * item.count;

          // Обновляем элемент табличной части
          await item.update(
            {
              costPrice: newCostPrice,
              costTotal: newCostTotal,
            },
            { transaction },
          );
        }),
      );

      await this.stocksService.flushPendingRemains(transaction);
      await transaction.commit();

      // Перезагружаем документ с обновленными данными
      const updatedDocument = await this.documentRepository.findOne({
        where: { id: documentId },
        include: [DocValues, DocTableItems],
      });

      if (!updatedDocument) {
        throw new Error(`Failed to reload document ${documentId} after update`);
      }

      return updatedDocument;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to recalculate costs: ${error.message}`);
    }
  }

  async getAmortizasiyaOsPreview(
    storageId: number,
    docDateMs: number,
    enterpriseId: number,
  ) {
    return buildOsAmortizationPreviewLines(
      storageId,
      docDateMs,
      enterpriseId,
      this.referencesService,
      this.stocksService,
    );
  }

  async getReceiveToolsPreview(
    clientId: number,
    warehouseId: number,
    returnDateTime: number,
    enterpriseId: number,
    _excludeDocId?: number,
  ) {
    const batches =
      await this.clientToolBatchesService.findOpenBatchesForClient(
        clientId,
        enterpriseId,
      );
    return this.clientToolBatchesService.buildPreviewRows(
      batches,
      returnDateTime,
      warehouseId,
      enterpriseId,
    );
  }

  async getSubleaseReceivePreview(
    clientId: number,
    returnDateTime: number,
    enterpriseId: number,
    partnerId?: number,
    excludeDocId?: number,
  ) {
    const batches =
      await this.subleaseToolBatchesService.findOpenBatchesForPreview(
        enterpriseId,
        clientId,
        partnerId,
        excludeDocId,
      );
    return this.subleaseToolBatchesService.buildPreviewRows(
      batches,
      returnDateTime,
    );
  }

  async resolvePartnerToolsStorage(
    partnerId: number,
    enterpriseId: number,
  ) {
    return this.referencesService.findPartnerToolsStorageByPartnerId(
      partnerId,
      enterpriseId,
    );
  }

  async getTransferToolsPreview(
    warehouseId: number,
    documentDate: number,
    enterpriseId: number,
    rentTariffType?: string | null,
  ): Promise<TransferToolsPreviewRow[]> {
    const oneDay = 24 * 60 * 60 * 1000;
    const targetDate = Number(documentDate) + oneDay;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const priceName = getRentTariffPriceName(rentTariffType);

    const candidateIds =
      await this.stocksService.getSecondSubcontoIdsWithStockForSchet(
        Schet.S11,
        warehouseId,
        enterpriseId,
      );
    if (!candidateIds.length) {
      return [];
    }

    const allRefs =
      await this.referencesService.getAllReferencesFromBase();
    const toolRefById = new Map(
      allRefs
        .filter(
          (ref) =>
            ref?.id != null &&
            ref.typeReference === TypeReference.TMZ &&
            ref.refValues?.typeTMZ === TypeTMZ.TOOLS,
        )
        .map((ref) => [Number(ref.id), ref] as const),
    );

    const toolCandidateIds = candidateIds.filter((id) => toolRefById.has(id));
    if (!toolCandidateIds.length) {
      return [];
    }

    const stockRows = await Promise.all(
      toolCandidateIds.map(async (toolId) => {
        const stock = await this.stocksService.getStockByDate(
          Schet.S11,
          warehouseId,
          toolId,
          targetDate,
          undefined,
          enterpriseId,
        );
        const remainCount = Number(stock.remainCount) || 0;
        if (remainCount <= 0) {
          return null;
        }
        const remainTotal = Number(stock.remainTotal) || 0;
        const costPrice = round2(remainTotal / remainCount);
        const costTotal = round2(costPrice * remainCount);

        const periodic = await this.pereodicService.getPeredicValueForDate(
          toolId,
          priceName,
          Number(documentDate),
          enterpriseId,
        );
        const rv = toolRefById.get(toolId)?.refValues;
        const fallbackPrice = Number(
          priceName === "thirdPrice" ? rv?.thirdPrice : rv?.firstPrice,
        );
        const hourlyTariff =
          Number(periodic) > 0
            ? Number(periodic)
            : fallbackPrice > 0
              ? fallbackPrice
              : 0;

        return {
          analiticId: toolId,
          count: remainCount,
          balance: remainCount,
          costPrice,
          costTotal,
          price: costPrice,
          total: costTotal,
          hourlyTariff,
        } satisfies TransferToolsPreviewRow;
      }),
    );

    return stockRows.filter(
      (row): row is TransferToolsPreviewRow => row != null,
    );
  }

  private async assertNoDuplicateAmortizasiyaOsMonth(
    document: Document,
    enterpriseId: number,
    transaction: Transaction,
  ) {
    const docDateMs = Number(document.date);
    const { monthStart, monthEnd } = getMonthBoundsFromDocDate(docDateMs);

    const existing = await this.documentRepository.findOne({
      where: {
        id: { [Op.ne]: document.id },
        documentType: DocumentType.AmortizasiyaOS,
        docStatus: DocSTATUS.PROVEDEN,
        enterpriseId,
        date: {
          [Op.gte]: monthStart,
          [Op.lte]: monthEnd,
        },
      },
      transaction,
    });

    if (existing) {
      throw new Error(
        `За этот месяц уже проведён документ амортизации ОС (№ ${existing.id})`,
      );
    }
  }

  private isToolOrderTableRow(row: {
    tableType?: string | null;
    analiticId?: number | null;
    count?: number | null;
  }): boolean {
    if (!row?.analiticId || Number(row.count) <= 0) return false;
    if (row.tableType === "sale" || row.tableType === "tovar") return false;
    return true;
  }

  private async getS11RemainMap(
    warehouseId: number,
    toolIds: number[],
    enterpriseId: number,
    asOfDate: number,
  ): Promise<Record<number, number>> {
    const remain: Record<number, number> = {};
    const uniqueIds = [...new Set(toolIds.filter((id) => id > 0))];
    const targetDate = Number(asOfDate) + 24 * 60 * 60 * 1000;
    await Promise.all(
      uniqueIds.map(async (toolId) => {
        const stock = await this.stocksService.getStockByDate(
          Schet.S11,
          warehouseId,
          toolId,
          targetDate,
          undefined,
          enterpriseId,
        );
        remain[toolId] = Number(stock.remainCount) || 0;
      }),
    );
    return remain;
  }

  private async toRentalOrderNeed(
    doc: Document,
    refNameById: Map<number, string>,
  ): Promise<RentalOrderNeed | null> {
    const lines = (doc.docTableItems || [])
      .filter((row) => this.isToolOrderTableRow(row))
      .map((row) => ({
        toolId: Number(row.analiticId),
        toolName: refNameById.get(Number(row.analiticId)),
        qty: Number(row.count) || 0,
      }));
    if (!lines.length) return null;
    const clientId = Number(doc.docValues?.receiverId) || 0;
    return {
      id: Number(doc.id),
      clientId,
      clientName: refNameById.get(clientId),
      warehouseId: Number(doc.docValues?.senderId) || 0,
      lines,
    };
  }

  async getReadyRentalOrders(enterpriseId: number): Promise<{
    enoughForAll: boolean;
    orders: Array<{
      id: number;
      clientId: number;
      clientName: string;
      warehouseId: number;
      lines: Array<{ toolId: number; toolName: string; qty: number }>;
    }>;
  }> {
    const orders = await this.documentRepository.findAll({
      where: {
        enterpriseId,
        documentType: DocumentType.OrderToolsToClient,
        docStatus: DocSTATUS.PROVEDEN,
      },
      include: [DocValues, DocTableItems],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    const openOrders = orders.filter((doc) => {
      const fulfilled = Number(doc.docValues?.fulfilledByTransferDocId) || 0;
      return fulfilled <= 0;
    });

    const allRefs = await this.referencesService.getAllReferencesFromBase();
    const refNameById = new Map(
      allRefs
        .filter((ref) => ref?.id != null)
        .map((ref) => [Number(ref.id), ref.name || `ID ${ref.id}`] as const),
    );

    const needs: RentalOrderNeed[] = [];
    for (const doc of openOrders) {
      const need = await this.toRentalOrderNeed(doc, refNameById);
      if (need) needs.push(need);
    }

    const warehouseId =
      needs.find((item) => item.warehouseId > 0)?.warehouseId || 0;
    const toolIds = needs.flatMap((item) => item.lines.map((line) => line.toolId));
    const remain = warehouseId
      ? await this.getS11RemainMap(
          warehouseId,
          toolIds,
          enterpriseId,
          Date.now(),
        )
      : {};

    const matched = matchReadyRentalOrders(needs, remain);
    return {
      enoughForAll: matched.enoughForAll,
      orders: matched.ready.map((item) => ({
        id: item.id,
        clientId: item.clientId,
        clientName: item.clientName || `ID ${item.clientId}`,
        warehouseId: item.warehouseId,
        lines: item.lines.map((line) => ({
          toolId: line.toolId,
          toolName: line.toolName || `ID ${line.toolId}`,
          qty: line.qty,
        })),
      })),
    };
  }

  private async getOrderStockSnapshot(
    order: Document,
    enterpriseId: number,
  ): Promise<{
    need: RentalOrderNeed;
    remain: Record<number, number>;
    missing: Array<{
      toolId: number;
      toolName?: string;
      need: number;
      remain: number;
    }>;
  }> {
    const allRefs = await this.referencesService.getAllReferencesFromBase();
    const refNameById = new Map(
      allRefs
        .filter((ref) => ref?.id != null)
        .map((ref) => [Number(ref.id), ref.name || `ID ${ref.id}`] as const),
    );
    const need = await this.toRentalOrderNeed(order, refNameById);
    if (!need) {
      throw new BadRequestException("Буюртмада ускуналар йўқ");
    }
    const warehouseId = need.warehouseId;
    if (!warehouseId) {
      throw new BadRequestException("Буюртмада склад танланмаган");
    }
    const remain = await this.getS11RemainMap(
      warehouseId,
      need.lines.map((line) => line.toolId),
      enterpriseId,
      Date.now(),
    );
    return {
      need,
      remain,
      missing: missingStockLines(need.lines, remain),
    };
  }

  async checkRentalOrderStock(
    orderId: number,
    enterpriseId: number,
  ): Promise<{
    ok: boolean;
    missing: Array<{
      toolId: number;
      toolName?: string;
      need: number;
      remain: number;
    }>;
  }> {
    const order = await this.documentRepository.findOne({
      where: {
        id: orderId,
        enterpriseId,
        documentType: DocumentType.OrderToolsToClient,
      },
      include: [DocValues, DocTableItems],
    });
    if (!order) {
      throw new BadRequestException("Буюртма топилмади");
    }
    const { missing } = await this.getOrderStockSnapshot(order, enterpriseId);
    return { ok: missing.length === 0, missing };
  }

  private async findLinkedTransferForOrder(
    orderId: number,
    transaction?: Transaction,
  ): Promise<Document | null> {
    return this.documentRepository.findOne({
      where: {
        documentType: DocumentType.TransferToolsToClient,
        docStatus: { [Op.ne]: DocSTATUS.DELETED },
      },
      include: [
        {
          model: DocValues,
          where: { sourceRentalOrderDocId: orderId },
          required: true,
        },
      ],
      transaction,
    });
  }

  private async assertTransferFromOrderCanPost(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const orderId = Number(doc.docValues?.sourceRentalOrderDocId) || 0;
    if (orderId <= 0) return;

    const enterpriseId = Number(doc.enterpriseId);
    const order = await this.documentRepository.findOne({
      where: {
        id: orderId,
        enterpriseId,
        documentType: DocumentType.OrderToolsToClient,
      },
      include: [DocValues, DocTableItems],
      transaction,
    });
    if (!order) {
      throw new BadRequestException("Буюртма топилмади");
    }
    if (order.docStatus !== DocSTATUS.PROVEDEN) {
      throw new BadRequestException("Буюртма навбатда эмас");
    }
    const fulfilledBy = Number(order.docValues?.fulfilledByTransferDocId) || 0;
    if (fulfilledBy > 0 && fulfilledBy !== Number(doc.id)) {
      throw new BadRequestException("Буюртма аллақачон ёпилган");
    }

    const { need, remain, missing } = await this.getOrderStockSnapshot(
      order,
      enterpriseId,
    );
    if (missing.length) {
      const details = missing
        .map(
          (row) =>
            `${row.toolName || row.toolId}: керак ${row.need}, қолдиқ ${row.remain}`,
        )
        .join("; ");
      throw new BadRequestException(
        `Буюртмани тўлиқ ёпиш учун ускуна етмайди. ${details}`,
      );
    }

    const transferQtyByTool = new Map<number, number>();
    for (const row of doc.docTableItems || []) {
      if (!this.isToolOrderTableRow(row)) continue;
      const toolId = Number(row.analiticId);
      transferQtyByTool.set(
        toolId,
        (transferQtyByTool.get(toolId) || 0) + (Number(row.count) || 0),
      );
    }
    for (const line of need.lines) {
      const have = transferQtyByTool.get(line.toolId) || 0;
      if (have + 0.0001 < line.qty) {
        throw new BadRequestException(
          `Топшириш буюртмани тўлиқ ёпмайди: ${line.toolName || line.toolId} керак ${line.qty}, ҳужжатда ${have}`,
        );
      }
    }
    void remain;
  }

  private async markOrderFulfilledByTransfer(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const orderId = Number(doc.docValues?.sourceRentalOrderDocId) || 0;
    if (orderId <= 0) return;
    const orderValues = await this.docValuesRepository.findOne({
      where: { docId: orderId },
      transaction,
    });
    if (!orderValues) return;
    await orderValues.update(
      { fulfilledByTransferDocId: Number(doc.id) },
      { transaction },
    );
  }

  private async clearOrderFulfillmentByTransfer(
    doc: Document,
    transaction: Transaction,
  ): Promise<void> {
    const orderId = Number(doc.docValues?.sourceRentalOrderDocId) || 0;
    if (orderId <= 0) return;
    const orderValues = await this.docValuesRepository.findOne({
      where: { docId: orderId },
      transaction,
    });
    if (!orderValues) return;
    const fulfilledBy = Number(orderValues.fulfilledByTransferDocId) || 0;
    if (fulfilledBy !== Number(doc.id)) return;
    await orderValues.update(
      { fulfilledByTransferDocId: null },
      { transaction },
    );
  }

  async createTransferFromRentalOrder(
    orderId: number,
    enterpriseId: number,
    userId: number,
  ): Promise<Document> {
    const order = await this.documentRepository.findOne({
      where: {
        id: orderId,
        enterpriseId,
        documentType: DocumentType.OrderToolsToClient,
      },
      include: [DocValues, DocTableItems],
    });
    if (!order) {
      throw new BadRequestException("Буюртма топилмади");
    }
    if (order.docStatus !== DocSTATUS.PROVEDEN) {
      throw new BadRequestException("Аввал буюртмани ўтказинг");
    }
    const fulfilledBy = Number(order.docValues?.fulfilledByTransferDocId) || 0;
    if (fulfilledBy > 0) {
      throw new BadRequestException("Буюртма аллақачон ёпилган");
    }
    const existing = await this.findLinkedTransferForOrder(orderId);
    if (existing) {
      const fullExisting = await this.documentRepository.findOne({
        where: { id: existing.id },
        include: [DocValues, DocTableItems],
      });
      return fullExisting || existing;
    }

    const { need, remain, missing } = await this.getOrderStockSnapshot(
      order,
      enterpriseId,
    );
    if (missing.length) {
      const details = missing
        .map(
          (row) =>
            `${row.toolName || row.toolId}: керак ${row.need}, қолдиқ ${row.remain}`,
        )
        .join("; ");
      throw new BadRequestException(
        `Складда ускуна етмайди. ${details}`,
      );
    }

    const warehouseId = need.warehouseId;
    const oneDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const rentTariffType = order.docValues?.rentTariffType || "CASH";
    const priceName = getRentTariffPriceName(rentTariffType);

    const tableItems: DocTableItemDto[] = [];
    for (const line of need.lines) {
      const stock = await this.stocksService.getStockByDate(
        Schet.S11,
        warehouseId,
        line.toolId,
        now + oneDay,
        undefined,
        enterpriseId,
      );
      const remainCount = Number(stock.remainCount) || 0;
      const remainTotal = Number(stock.remainTotal) || 0;
      const costPrice =
        remainCount > 0 ? Math.round((remainTotal / remainCount) * 100) / 100 : 0;
      const costTotal = Math.round(costPrice * line.qty * 100) / 100;
      const periodic = await this.pereodicService.getPeredicValueForDate(
        line.toolId,
        priceName,
        now,
        enterpriseId,
      );
      const hourlyTariff = Number(periodic) > 0 ? Number(periodic) : 0;
      tableItems.push({
        analiticId: line.toolId,
        count: line.qty,
        balance: remain[line.toolId] || 0,
        costPrice,
        costTotal,
        price: costPrice,
        total: costTotal,
        hourlyTariff,
        dailyRent: Math.round(hourlyTariff * line.qty * 24 * 100) / 100,
        tableType: "income",
      });
    }

    return this.createDocument(
      {
        date: now as any,
        userId,
        userOldId: "",
        documentType: DocumentType.TransferToolsToClient,
        docStatus: DocSTATUS.OPEN,
        saveOnly: true,
        enterpriseId,
        docValues: {
          senderId: warehouseId,
          receiverId: need.clientId,
          rentTariffType,
          settlementDate: now,
          sourceRentalOrderDocId: orderId,
          comment: `Буюртма №${orderId}`,
          materialResponsiblePersonId:
            order.docValues?.materialResponsiblePersonId || undefined,
        },
        docTableItems: tableItems,
      } as UpdateCreateDocumentDto,
      this.usersService,
      this.referencesService,
    );
  }
}
