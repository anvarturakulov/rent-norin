import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { Reference } from "./reference.model";
import { InjectModel } from "@nestjs/sequelize";
import {
  TypeReference,
  CarType,
  TypePartners,
  TypeTMZ,
  TypeSECTION,
  isTmzAttributeDictionaryType,
} from "src/interfaces/reference.interface";
import {
  buildTmzShortNameDictKey,
  effectiveTmzShortNameText,
  trimAttr,
} from "./helpers/tmzAttributeDictionary.helper";
import { RefValues } from "src/refvalues/refValues.model";
import { UpdateCreateReferenceDto } from "./dto/updateCreateReference.dto";
import { convertJsonRef } from "./helpers/convertJsonRef";
import { ForeignKeyConstraintError, Op } from "sequelize";
import { UserRoles } from "src/interfaces/user.interface";
import { Enterprise } from "src/enterprises/enterprise.model";
import { partnerHasMediatorRole } from "src/documents/helper/mediatorBonus.helper";
import { isGlobalRole } from "src/utils/roleHelpers";
import { nextTmzArticleString } from "src/common/numbering/nextTmzArticle";
import { nextWorksArticleString } from "src/common/numbering/nextWorksArticle";
import { buildTmzDisplayName } from "./helpers/buildTmzDisplayName";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { Document } from "src/documents/document.model";
import { ProductNormsService } from "src/productNorms/product-norms.service";
import { ReplaceProductNormsDto } from "src/productNorms/dto/replace-product-norms.dto";
import { RentalContract } from "src/rentalContracts/rentalContract.model";
import { ClientContract } from "src/clientContracts/clientContract.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { ClientToolOpenBatch } from "src/clientToolBatches/clientToolOpenBatch.model";
import { SubleaseToolOpenBatch } from "src/subleaseToolBatches/subleaseToolOpenBatch.model";
import * as fs from "fs";
import { extname, join } from "path";

export type ReferenceUsageField =
  | "shortNameId"
  | "sizeId"
  | "colorId"
  | "textureId"
  | "manufactureId"
  | "unitId";

export interface ReferenceUsageInReference {
  referenceId: number;
  name: string;
  article?: string | null;
  typeReference: TypeReference;
  field: ReferenceUsageField;
}

export interface ReferenceUsageInDocument {
  documentId: bigint;
  documentType?: string | null;
  date?: bigint | null;
  field: string;
}

export interface ReferenceUsageInRelated {
  source: string;
  id: number;
  label: string;
  field: string;
}

export interface ReferenceUsageSummary {
  referenceId: number;
  inReferences: ReferenceUsageInReference[];
  inDocuments: ReferenceUsageInDocument[];
  inRelated: ReferenceUsageInRelated[];
  counts: {
    inReferences: number;
    inDocuments: number;
    inRelated: number;
    total: number;
  };
  canDelete: boolean;
}

@Injectable()
export class ReferencesService implements OnModuleInit {
  public refList: Reference[] = []; // Публичное свойство для кэша
  private readonly logger = new Logger(ReferencesService.name);

  constructor(
    @InjectModel(Reference) private referenceRepository: typeof Reference,
    @InjectModel(RefValues) private refValuesRepository: typeof RefValues,
    @InjectModel(DocValues) private docValuesRepository: typeof DocValues,
    @InjectModel(DocTableItems)
    private docTableItemsRepository: typeof DocTableItems,
    @InjectModel(RentalContract)
    private rentalContractRepository: typeof RentalContract,
    @InjectModel(ClientContract)
    private clientContractRepository: typeof ClientContract,
    @InjectModel(FurnitureOrder)
    private furnitureOrderRepository: typeof FurnitureOrder,
    @InjectModel(ClientToolOpenBatch)
    private clientToolOpenBatchRepository: typeof ClientToolOpenBatch,
    @InjectModel(SubleaseToolOpenBatch)
    private subleaseToolOpenBatchRepository: typeof SubleaseToolOpenBatch,
    @Inject(forwardRef(() => ProductNormsService))
    private productNormsService: ProductNormsService,
  ) {}

  /** DATEONLY / DATE поля refvalues из DTO приходят строкой */
  private normalizeRefValuesPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out = { ...payload };
    const raw = out.amortizationStartDate;
    if (raw != null && raw !== "") {
      if (typeof raw === "string") {
        out.amortizationStartDate = new Date(raw);
      }
    } else if (raw === "") {
      out.amortizationStartDate = null;
    }
    if (out.area != null && out.area !== "") {
      const areaNum = Number(out.area);
      if (Number.isFinite(areaNum)) {
        out.area = Math.trunc(areaNum * 1000) / 1000;
      }
    }
    return out;
  }

  // Инициализация при старте приложения
  async onModuleInit() {
    await this.updateRefList();
  }

  private normalizeArticle(article?: string | null): string | undefined {
    if (article === undefined || article === null) return undefined;
    const normalized = article.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  /** Подтянуть текстовые реквизиты ТМЗ из связанных справочников по *Id. */
  private async syncTmzAttributeTextsFromIds(
    payload: Record<string, unknown>,
    tmzDisplayName?: string,
  ): Promise<void> {
    const pairs: Array<[keyof Record<string, unknown>, string]> = [
      ["shortNameId", "shortName"],
      ["sizeId", "size"],
      ["colorId", "color"],
      ["textureId", "texture"],
      ["manufactureId", "manufacture"],
      ["unitId", "unit"],
    ];
    for (const [idKey, textKey] of pairs) {
      const rawId = payload[idKey];
      if (rawId == null || rawId === "") continue;
      const dict = await this.referenceRepository.findByPk(Number(rawId));
      if (dict?.name) {
        payload[textKey] = dict.name;
      }
    }
    const typeTMZ = payload.typeTMZ as TypeTMZ | undefined;
    const effectiveShort = effectiveTmzShortNameText(
      payload.shortName,
      tmzDisplayName,
      typeTMZ,
    );
    if (effectiveShort && !trimAttr(payload.shortName)) {
      payload.shortName = effectiveShort;
    }
  }

  private async assertTmzDictionaryNotDuplicate(
    typeReference: TypeReference,
    name: string,
    enterpriseId: number | null | undefined,
    typeTMZ?: TypeTMZ,
    excludeReferenceId?: number,
  ): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new HttpException("Название не может быть пустым", HttpStatus.BAD_REQUEST);
    }

    if (typeReference === TypeReference.TMZ_SHORT_NAME) {
      if (!typeTMZ) {
        throw new HttpException(
          "Для краткого наименования укажите тип ТМЗ",
          HttpStatus.BAD_REQUEST,
        );
      }
      const existing = await this.referenceRepository.findAll({
        where: {
          typeReference,
          name: trimmed,
          enterpriseId: enterpriseId ?? null,
          ...(excludeReferenceId
            ? { id: { [Op.ne]: excludeReferenceId } }
            : {}),
        },
        include: [
          {
            model: RefValues,
            where: { typeTMZ },
            required: true,
          },
        ],
        limit: 1,
      });
      if (existing.length > 0) {
        throw new HttpException(
          `Значение "${trimmed}" уже есть в справочнике кратких наименований для типа ${typeTMZ}`,
          HttpStatus.CONFLICT,
        );
      }
      return;
    }

    const where: Record<string, unknown> = {
      typeReference,
      name: trimmed,
      enterpriseId: enterpriseId ?? null,
    };
    if (excludeReferenceId) {
      where.id = { [Op.ne]: excludeReferenceId };
    }
    const dup = await this.referenceRepository.findOne({ where: where as any });
    if (dup) {
      throw new HttpException(
        `Значение "${trimmed}" уже есть в справочнике`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private resolveReferenceName(
    typeReference: TypeReference,
    isFolder: boolean,
    clientName: string,
    dtoRefValues?: Record<string, unknown> | null,
    existingRefValues?: RefValues | null,
  ): string {
    if (typeReference !== TypeReference.TMZ || isFolder) {
      return clientName;
    }
    const rv = dtoRefValues ?? {};
    const existing = existingRefValues as Record<string, unknown> | null;
    const typeTMZ = (rv.typeTMZ ?? existing?.typeTMZ) as TypeTMZ | undefined;
    const shortName = effectiveTmzShortNameText(
      rv.shortName ?? existing?.shortName,
      clientName,
      typeTMZ,
    );
    const parts =
      typeTMZ === TypeTMZ.OS
        ? {
            shortName,
            texture: (rv.texture ?? existing?.texture) as string | undefined,
          }
        : {
            shortName,
            size: (rv.size ?? existing?.size) as string | undefined,
            color: (rv.color ?? existing?.color) as string | undefined,
            texture: (rv.texture ?? existing?.texture) as string | undefined,
            manufacture: (rv.manufacture ?? existing?.manufacture) as
              | string
              | undefined,
          };
    const built = buildTmzDisplayName(parts);
    return built.trim() || clientName.trim();
  }

  private async checkTMZArticleUnique(
    article: string,
    enterpriseId?: number | null,
    excludeReferenceId?: number,
  ): Promise<void> {
    const where: any = {
      typeReference: TypeReference.TMZ,
      article,
      enterpriseId,
    };

    if (excludeReferenceId) {
      where.id = { [Op.ne]: excludeReferenceId };
    }

    const existingReference = await this.referenceRepository.findOne({ where });
    if (existingReference) {
      throw new HttpException(
        `Артикул "${article}" уже используется для TMZ в выбранной организации`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async checkStoragesArticleUnique(
    article: string,
    enterpriseId?: number | null,
    excludeReferenceId?: number,
  ): Promise<void> {
    const where: any = {
      typeReference: TypeReference.STORAGES,
      article,
      enterpriseId,
    };

    if (excludeReferenceId) {
      where.id = { [Op.ne]: excludeReferenceId };
    }

    const existingReference = await this.referenceRepository.findOne({ where });
    if (existingReference) {
      throw new HttpException(
        `Артикул "${article}" уже используется для складов/цехов в выбранной организации`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async checkWorksArticleUnique(
    article: string,
    enterpriseId?: number | null,
    excludeReferenceId?: number,
  ): Promise<void> {
    const where: any = {
      typeReference: TypeReference.WORKS,
      article,
      enterpriseId,
    };

    if (excludeReferenceId) {
      where.id = { [Op.ne]: excludeReferenceId };
    }

    const existingReference = await this.referenceRepository.findOne({ where });
    if (existingReference) {
      throw new HttpException(
        `Артикул "${article}" уже используется для работ в выбранной организации`,
        HttpStatus.CONFLICT,
      );
    }
  }

  // Обновление кэша
  private async updateRefList() {
    // console.time('UpdateRefList');
    this.refList = await this.referenceRepository.findAll({
      include: [RefValues],
    });
    // console.timeEnd('UpdateRefList');
  }

  // Получение всех references из кэша
  async getAllReferences(): Promise<Reference[]> {
    return this.refList;
  }

  // Получение всех references
  async getAllReferencesFromBase(): Promise<Reference[]> {
    const references = await this.referenceRepository.findAll({
      include: [RefValues],
    });
    return references;
  }

  /**
   * Получение references для отчетов с фильтрацией на уровне БД.
   * TMZ всегда возвращаются все (независимо от enterpriseId).
   * При заданном enterpriseId к основной выборке добавляются склады (STORAGES) с любым непустым enterpriseId
   * для межпредприятийских остатков (S41 / DebitorKreditor DEPARTMENTS).
   * @param enterpriseId - ID предприятия или null для глобального отчета
   * @returns Отфильтрованные references
   */
  async getReferencesForReport(
    enterpriseId?: number | null,
  ): Promise<Reference[]> {
    // ВАЖНО: TMZ товары всегда возвращаем все (независимо от enterpriseId)
    // Это необходимо для корректной работы отчетов (например, foydaByProduction)
    // где нужно определять товары бетона по productionType, а не по enterpriseId

    // Загружаем все TMZ товары без фильтрации по enterpriseId
    const tmzReferences = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.TMZ,
      },
      include: [RefValues],
    });

    // Для остальных типов справочников применяем фильтрацию по enterpriseId
    const where: any = {
      typeReference: { [Op.ne]: TypeReference.TMZ }, // Исключаем TMZ, так как они уже загружены
    };

    // Если enterpriseId указан, фильтруем по нему (включая null - общие справочники)
    if (enterpriseId !== null && enterpriseId !== undefined) {
      where[Op.or] = [
        { enterpriseId: null }, // Общие справочники
        { enterpriseId: enterpriseId }, // Справочники предприятия
      ];
    }
    // ВАЖНО: если enterpriseId = null, НЕ добавляем фильтр по enterpriseId - показываем ВСЕ справочники
    // Это необходимо для глобальных пользователей (HEADGLOBAL, ADMINGLOBAL) которые хотят видеть все данные

    // Загружаем остальные references с фильтрацией по enterpriseId
    const otherReferences = await this.referenceRepository.findAll({
      where:
        Object.keys(where).length > 1
          ? where
          : { typeReference: { [Op.ne]: TypeReference.TMZ } }, // Если есть фильтр по enterpriseId, применяем его
      include: [RefValues],
    });

    // Объединяем TMZ (все) и остальные (отфильтрованные)
    const allReferences = [...tmzReferences, ...otherReferences];
    const seenIds = new Set(allReferences.map((r) => r.id));

    // Склады с привязкой к любой организации (enterpriseId != null) — для S41 / DebitorKreditor DEPARTMENTS
    // и имён в межпредприятийских отчётах; при фильтре otherReferences чужие склады не попадают в выборку
    if (enterpriseId !== null && enterpriseId !== undefined) {
      const storagesAnyEnterprise = await this.referenceRepository.findAll({
        where: {
          typeReference: TypeReference.STORAGES,
          enterpriseId: { [Op.ne]: null },
        },
        include: [RefValues],
      });
      for (const ref of storagesAnyEnterprise) {
        if (!seenIds.has(ref.id)) {
          seenIds.add(ref.id);
          allReferences.push(ref);
        }
      }
    }

    return allReferences;
  }

  /**
   * Загружает ВСЕ references без фильтрации по enterpriseId
   * Используется для межпредприятийных отчетов (например, актсверка по DEPARTMENTS)
   */
  async getAllReferencesForReport(): Promise<Reference[]> {
    const allReferences = await this.referenceRepository.findAll({
      include: [RefValues],
    });
    return allReferences;
  }

  /** Include/attributes для byType: slim — лёгкий ответ для селектов словарей ТМЗ */
  private getByTypeFindOptions(typeReference: TypeReference, slim?: boolean) {
    if (slim) {
      const refValuesAttrs =
        typeReference === TypeReference.TMZ_SHORT_NAME
          ? (["markToDeleted", "typeTMZ"] as const)
          : (["markToDeleted"] as const);
      return {
        attributes: ["id", "name", "isFolder", "enterpriseId"] as string[],
        include: [
          {
            model: RefValues,
            attributes: [...refValuesAttrs],
          },
        ],
      };
    }
    return {
      include: [
        RefValues,
        {
          model: Enterprise as any,
          as: "enterprise",
          required: false,
          attributes: ["id", "name", "code"],
        },
      ],
    };
  }

  // Остальные методы остаются без изменений, но обновляют кэш при необходимости
  async getReferenceByType(
    typeReference: TypeReference,
    enterpriseId?: number,
    userRole?: string,
    userEnterpriseId?: number | null,
    sourceEnterpriseId?: number | null,
    slim?: boolean,
  ) {
    // Всегда фильтруем по typeReference
    const where: any = {
      typeReference,
    };
    const findOpts = this.getByTypeFindOptions(typeReference, slim);

    // Для глобальных ролей (ADMINGLOBAL, HEADGLOBAL и т.д.), когда enterpriseId не передан,
    // показываем все справочники указанного типа
    if (
      userRole &&
      isGlobalRole(userRole as UserRoles) &&
      enterpriseId === undefined
    ) {
      return this.referenceRepository.findAll({
        where: { typeReference },
        ...findOpts,
      });
    }

    // Если передан enterpriseId напрямую, используем его для фильтрации (приоритет над userEnterpriseId)
    // Это нужно для случаев, когда нужно загрузить справочники другой организации
    if (enterpriseId !== undefined) {
      const enterpriseIds = [null, enterpriseId]; // Общие справочники + справочники указанной организации
      if (
        sourceEnterpriseId !== undefined &&
        sourceEnterpriseId !== null &&
        sourceEnterpriseId !== enterpriseId
      ) {
        enterpriseIds.push(sourceEnterpriseId);
      }

        where[Op.and] = [
        { typeReference },
        {
          [Op.or]: enterpriseIds.map((id) => ({ enterpriseId: id })),
        },
      ];
    } else if (userEnterpriseId !== undefined && userEnterpriseId !== null) {
      // STORAGES: без фильтра по enterpriseId — кассы/склады других организаций
      // (MoveCash и т.д.); ужесточение на фронте и в проведении документов.
      if (typeReference === TypeReference.STORAGES) {
        // where уже { typeReference }
      } else {
        const enterpriseIds = [null, userEnterpriseId];

        if (
          sourceEnterpriseId !== undefined &&
          sourceEnterpriseId !== null &&
          sourceEnterpriseId !== userEnterpriseId
        ) {
          enterpriseIds.push(sourceEnterpriseId);
        }

        where[Op.and] = [
          { typeReference },
          {
            [Op.or]: enterpriseIds.map((id) => ({ enterpriseId: id })),
          },
        ];
      }
    } else {
      // Если enterpriseId не указан, показываем только справочники с null enterpriseId
      // и справочники отправителя, если передан sourceEnterpriseId
      if (sourceEnterpriseId !== undefined && sourceEnterpriseId !== null) {
        where[Op.and] = [
          { typeReference },
          {
            [Op.or]: [
              { enterpriseId: null },
              { enterpriseId: sourceEnterpriseId },
            ],
          },
        ];
      } else {
        where.enterpriseId = null;
      }
    }

    return this.referenceRepository.findAll({
      where,
      ...findOpts,
    });
  }

  async getReferenceById(id: number) {
    const reference = await this.referenceRepository.findOne({
      where: { id },
      include: [RefValues],
    });
    return reference;
  }

  /**
   * Находит справочник STORAGES с typeSection COMMON по enterpriseId организации
   */
  async findCommonStorageByEnterpriseId(enterpriseId: number) {
    const reference = await this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: {
            typeSection: TypeSECTION.COMMON,
          },
          required: true,
        },
      ],
    });
    return reference;
  }

  /**
   * Виртуальный склад субаренды партнёра (PARTNER_TOOLS + partnerId).
   */
  async findPartnerToolsStorageByPartnerId(
    partnerId: number,
    enterpriseId: number,
  ) {
    return this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: {
            typeSection: TypeSECTION.PARTNER_TOOLS,
            partnerId,
          },
          required: true,
        },
      ],
    });
  }

  /**
   * Касса STORAGES по предприятию: накд, пластик или валютная касса (Валюта х.р).
   */
  async findCashStorageByEnterpriseId(
    enterpriseId: number,
    filter: "cash" | "plastic" | "foreignCash",
  ) {
    let refValuesWhere: Record<string, unknown>;
    switch (filter) {
      case "cash":
        refValuesWhere = {
          typeSection: TypeSECTION.CASH,
          [Op.or]: [{ isForeign: false }, { isForeign: null }],
        };
        break;
      case "plastic":
        refValuesWhere = { typeSection: TypeSECTION.PLASTIK };
        break;
      case "foreignCash":
        refValuesWhere = { typeSection: TypeSECTION.CASH, isForeign: true };
        break;
    }

    return this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: refValuesWhere,
          required: true,
        },
      ],
    });
  }

  /**
   * Склад брака (typeSection STORAGE + isDefectWarehouse).
   */
  async findDefectStorageByEnterpriseId(enterpriseId: number) {
    return this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: {
            typeSection: TypeSECTION.STORAGE,
            isDefectWarehouse: true,
          },
          required: true,
        },
      ],
    });
  }

  /**
   * Склад готовой продукции / полуфабриката (typeSection STORAGE), иначе COMMON.
   */
  async findProductStorageByEnterpriseId(enterpriseId: number) {
    const storage = await this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: { typeSection: TypeSECTION.STORAGE },
          required: true,
        },
      ],
    });
    if (storage) return storage;
    return this.findCommonStorageByEnterpriseId(enterpriseId);
  }

  /**
   * Производственный цех/склад (typeSection PRODUCTION).
   */
  async findProductionStorageByEnterpriseId(enterpriseId: number) {
    return this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.STORAGES,
        enterpriseId,
      },
      include: [
        {
          model: RefValues,
          where: { typeSection: TypeSECTION.PRODUCTION },
          required: true,
        },
      ],
    });
  }

  async checkReferenceExists(
    name: string,
    typeReference: TypeReference,
    enterpriseId?: number,
  ): Promise<boolean> {
    const existingReference = await this.referenceRepository.findOne({
      where: {
        name,
        typeReference,
        enterpriseId: enterpriseId ?? null,
      },
    });
    return !!existingReference;
  }

  async getWorker(telegramId: string) {
    const normalized = String(telegramId || "").trim();
    if (!normalized) return null;

    const reference = await this.referenceRepository.findOne({
      where: { typeReference: TypeReference.WORKERS },
      include: [
        {
          model: RefValues,
          where: { telegramId: normalized },
          required: true,
        },
      ],
    });
    return reference;
  }

  async findPartnerMediatorByTelegramId(
    telegramId: string,
    enterpriseId?: number | null,
  ): Promise<Reference> {
    const normalizedTelegramId = String(telegramId || "").trim();
    if (!normalizedTelegramId) {
      throw new HttpException("Telegram ID не передан", HttpStatus.BAD_REQUEST);
    }

    const enterpriseWhere =
      enterpriseId != null && Number.isFinite(Number(enterpriseId))
        ? {
            [Op.or]: [
              { enterpriseId: Number(enterpriseId) },
              { enterpriseId: null },
            ],
          }
        : {};

    const references = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.PARTNERS,
        ...enterpriseWhere,
      },
      include: [
        {
          model: RefValues,
          where: {
            telegramId: normalizedTelegramId,
            [Op.or]: [
              { isMediatorDriver: true },
              { isMediatorMaster: true },
            ],
          },
          required: true,
        },
      ],
      limit: 2,
    });

    const withRole = references.filter((ref) =>
      partnerHasMediatorRole(ref.refValues),
    );

    if (!withRole.length) {
      throw new HttpException(
        "Партнёр-посредник с таким Telegram ID не найден. Укажите Telegram ID в справочнике Партнёры и включите Хайдовчи или Уста.",
        HttpStatus.NOT_FOUND,
      );
    }
    if (withRole.length > 1) {
      throw new HttpException(
        "Обнаружены дубли Telegram ID у партнёров-посредников",
        HttpStatus.CONFLICT,
      );
    }
    return withRole[0];
  }

  async findClientByTelegramIdAndEnterprise(
    telegramId: string,
    enterpriseId: number,
  ): Promise<Reference> {
    const normalizedTelegramId = String(telegramId || "").trim();
    if (!normalizedTelegramId) {
      throw new HttpException("Telegram ID не передан", HttpStatus.BAD_REQUEST);
    }

    const enterpriseWhere =
      enterpriseId != null && Number.isFinite(Number(enterpriseId))
        ? {
            [Op.or]: [
              { enterpriseId: Number(enterpriseId) },
              { enterpriseId: null },
            ],
          }
        : {};

    const references = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.PARTNERS,
        ...enterpriseWhere,
      },
      include: [
        {
          model: RefValues,
          where: {
            telegramId: normalizedTelegramId,
            typePartners: TypePartners.CLIENTS,
          },
          required: true,
        },
      ],
      limit: 2,
    });

    if (!references.length) {
      throw new HttpException(
        "Клиент с таким Telegram ID не найден в организации",
        HttpStatus.NOT_FOUND,
      );
    }
    if (references.length > 1) {
      throw new HttpException(
        "Обнаружены дубли Telegram ID у клиентов",
        HttpStatus.CONFLICT,
      );
    }
    return references[0];
  }

  async findClientByTelegramId(telegramId: string): Promise<Reference> {
    const normalizedTelegramId = String(telegramId || "").trim();
    if (!normalizedTelegramId) {
      throw new HttpException("Telegram ID не передан", HttpStatus.BAD_REQUEST);
    }

    const references = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.PARTNERS,
      },
      include: [
        {
          model: RefValues,
          where: {
            telegramId: normalizedTelegramId,
            typePartners: TypePartners.CLIENTS,
          },
          required: true,
        },
      ],
      limit: 2,
    });

    if (!references.length) {
      throw new HttpException(
        "Клиент с таким Telegram ID не найден",
        HttpStatus.NOT_FOUND,
      );
    }

    if (references.length > 1) {
      throw new HttpException(
        "Обнаружены дубли Telegram ID у клиентов",
        HttpStatus.CONFLICT,
      );
    }

    return references[0];
  }

  /** То же, что findClientByTelegramId, но без исключения при отсутствии записи. */
  async findClientByTelegramIdOrNull(
    telegramId: string,
  ): Promise<Reference | null> {
    const normalizedTelegramId = String(telegramId || "").trim();
    if (!normalizedTelegramId) {
      return null;
    }

    const references = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.PARTNERS,
      },
      include: [
        {
          model: RefValues,
          where: {
            telegramId: normalizedTelegramId,
            typePartners: TypePartners.CLIENTS,
          },
          required: true,
        },
      ],
      limit: 2,
    });

    if (!references.length) {
      return null;
    }

    if (references.length > 1) {
      throw new HttpException(
        "Обнаружены дубли Telegram ID у клиентов",
        HttpStatus.CONFLICT,
      );
    }

    return references[0];
  }

  async updateClientLocationByReferenceId(
    referenceId: number,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const refValues = await this.refValuesRepository.findOne({
      where: { referenceId },
    });
    if (!refValues) {
      throw new HttpException(
        "RefValues для клиента не найдены",
        HttpStatus.NOT_FOUND,
      );
    }
    await refValues.update({
      location: JSON.stringify({ latitude, longitude }),
    });
    await this.updateRefList();
  }

  async updateClientPhoneByReferenceId(
    referenceId: number,
    phone: string,
  ): Promise<void> {
    const refValues = await this.refValuesRepository.findOne({
      where: { referenceId },
    });
    if (!refValues) {
      throw new HttpException(
        "RefValues для клиента не найдены",
        HttpStatus.NOT_FOUND,
      );
    }
    const trimmed = String(phone || "").trim();
    await refValues.update({
      phone: trimmed.length ? trimmed : "",
    });
    await this.updateRefList();
  }

  async getClientTelegramIdByPartnerId(
    partnerId: number,
  ): Promise<string | null> {
    const reference = await this.referenceRepository.findOne({
      where: {
        id: partnerId,
        typeReference: TypeReference.PARTNERS,
      },
      include: [
        {
          model: RefValues,
          where: {
            typePartners: TypePartners.CLIENTS,
          },
          required: false,
        },
      ],
    });

    if (!reference?.refValues?.telegramId) {
      return null;
    }

    const normalizedTelegramId = String(reference.refValues.telegramId).trim();
    return normalizedTelegramId.length ? normalizedTelegramId : null;
  }

  /**
   * Проверяет, является ли справочник общим (доступен всем организациям)
   */
  private isSharedReference(reference: Reference): boolean {
    // Общие справочники имеют enterpriseId = null
    if (reference.enterpriseId === null) {
      return true;
    }
    return false;
  }

  /**
   * PARTNERS (кроме DEPARTMENTS), WORKERS, CHARGES — общие для всех организаций (enterpriseId = null).
   */
  private isEnterpriseSharedDirectoryType(
    typeReference: TypeReference,
    refValues?: any,
  ): boolean {
    if (typeReference === TypeReference.WORKERS) {
      return true;
    }
    if (typeReference === TypeReference.CHARGES) {
      return true;
    }
    if (typeReference === TypeReference.SERVICES) {
      return true;
    }
    if (typeReference === TypeReference.PARTNERS) {
      const typePartners = refValues?.typePartners;
      if (typePartners === TypePartners.DEPARTMENTS) {
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Проверяет, является ли справочник общим по типу (DEPARTMENTS, PRODUCT, MATERIAL, WORKERS, CHARGES, PARTNERS)
   */
  private isSharedReferenceType(
    typeReference: TypeReference,
    refValues?: any,
  ): boolean {
    if (this.isEnterpriseSharedDirectoryType(typeReference, refValues)) {
      return true;
    }
    // DEPARTMENTS
    if (
      typeReference === TypeReference.PARTNERS &&
      refValues?.typePartners === TypePartners.DEPARTMENTS
    ) {
      return true;
    }
    // PRODUCT
    if (
      typeReference === TypeReference.TMZ &&
      refValues?.typeTMZ === TypeTMZ.PRODUCT
    ) {
      return true;
    }
    // MATERIAL
    if (
      typeReference === TypeReference.TMZ &&
      refValues?.typeTMZ === TypeTMZ.MATERIAL
    ) {
      return true;
    }
    return false;
  }

  private isTmzOrTmzDictionary(
    typeReference?: TypeReference,
    existingType?: TypeReference,
  ): boolean {
    const types = [typeReference, existingType].filter(
      (t): t is TypeReference => t != null,
    );
    return types.some(
      (t) => t === TypeReference.TMZ || isTmzAttributeDictionaryType(t),
    );
  }

  /**
   * Проверяет права доступа для редактирования справочника
   * userEnterpriseId — enterpriseId пользователя; для GLAVBUX/HEADCOMPANY разрешено редактировать только справочники своей организации или общие (enterpriseId === null)
   * allowByReferencePermission — контроллер уже пропустил пользователя по canEdit/canCreate; для TMZ и словарей реквизитов разрешает общие карточки и enterpriseId === null
   */
  private checkEditPermission(
    reference: Reference | null,
    userRole: string,
    typeReference?: TypeReference,
    refValues?: any,
    userEnterpriseId?: number | null,
    allowByReferencePermission = false,
  ): void {
    const isGlavbuxOrHeadCompany =
      userRole === UserRoles.GLAVBUX || userRole === UserRoles.HEADCOMPANY;
    const allowSharedTmzByPermission =
      allowByReferencePermission &&
      this.isTmzOrTmzDictionary(typeReference, reference?.typeReference);

    // GLAVBUX и HEADCOMPANY: блокируем только когда user.enterpriseId передан (число) и не совпадает со справочником
    if (
      reference &&
      isGlavbuxOrHeadCompany &&
      reference.enterpriseId != null &&
      typeof userEnterpriseId === "number"
    ) {
      if (reference.enterpriseId !== userEnterpriseId) {
        throw new HttpException(
          "Можно редактировать только справочники своей организации",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Если справочник существует и имеет enterpriseId = null, только ADMINGLOBAL, HEADGLOBAL (для TMZ) и GLAVBUX/HEADCOMPANY (для общих типов) могут редактировать
    if (
      reference &&
      reference.enterpriseId === null &&
      userRole !== UserRoles.ADMINGLOBAL &&
      !allowSharedTmzByPermission
    ) {
      const typeRef = typeReference ?? reference.typeReference;
      const refVals = reference.refValues ?? refValues;
      const isHeadGlobalTMZ =
        userRole === UserRoles.HEADGLOBAL &&
        (typeRef === TypeReference.TMZ ||
          reference.typeReference === TypeReference.TMZ);
      const isGlavbuxOrHeadCompanyShared =
        (userRole === UserRoles.GLAVBUX ||
          userRole === UserRoles.HEADCOMPANY) &&
        (this.isSharedReferenceType(
          reference.typeReference,
          reference.refValues,
        ) ||
          this.isSharedReferenceType(typeRef, refVals) ||
          reference.typeReference === TypeReference.TMZ ||
          reference.typeReference === TypeReference.PARTNERS);
      if (!isHeadGlobalTMZ && !isGlavbuxOrHeadCompanyShared) {
        throw new HttpException(
          "Только администратор может редактировать справочники с незаданной организацией",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Если справочник существует и является общим по типу, или если создается новый общий справочник
    const isShared = reference
      ? this.isSharedReference(reference)
      : typeReference && refValues
        ? this.isSharedReferenceType(typeReference, refValues)
        : false;

    // Разрешаем ADMINGLOBAL, HEADGLOBAL (для TMZ), GLAVBUX и HEADCOMPANY редактировать общие справочники
    if (
      isShared &&
      userRole !== UserRoles.ADMINGLOBAL &&
      !allowSharedTmzByPermission
    ) {
      const isHeadGlobalTMZ =
        userRole === UserRoles.HEADGLOBAL &&
        typeReference === TypeReference.TMZ;
      if (!isHeadGlobalTMZ && !isGlavbuxOrHeadCompany) {
        throw new HttpException(
          "Только администратор может редактировать общие справочники",
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  async updateReferenceById(
    id: number,
    dto: UpdateCreateReferenceDto,
    userRole?: string,
    userEnterpriseId?: number | null,
    allowByReferencePermission = false,
  ) {
    const reference = await this.referenceRepository.findOne({
      where: { id },
      include: [RefValues],
    });

    if (!reference) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    if (userRole) {
      this.checkEditPermission(
        reference,
        userRole,
        dto.typeReference,
        dto.refValues,
        userEnterpriseId,
        allowByReferencePermission,
      );
    }

    const { name, typeReference, parentId, isFolder, enterpriseId } = dto;
    delete (dto as { tmzDictKey?: unknown }).tmzDictKey;
    const referenceType = typeReference ?? reference.typeReference;
    const folderFlag =
      isFolder !== undefined ? isFolder : Boolean(reference.isFolder);

    if (referenceType === TypeReference.TMZ && dto.refValues) {
      const mergedRv = {
        ...(reference.refValues as unknown as Record<string, unknown>),
        ...(dto.refValues as Record<string, unknown>),
      };
      await this.syncTmzAttributeTextsFromIds(mergedRv, name);
      dto.refValues = mergedRv as UpdateCreateReferenceDto["refValues"];
    }

    if (isTmzAttributeDictionaryType(referenceType)) {
      await this.assertTmzDictionaryNotDuplicate(
        referenceType,
        name,
        enterpriseId !== undefined ? enterpriseId : reference.enterpriseId,
        (dto.refValues as { typeTMZ?: TypeTMZ })?.typeTMZ ??
          reference.refValues?.typeTMZ,
        id,
      );
    }

    const resolvedName = this.resolveReferenceName(
      referenceType,
      folderFlag,
      name,
      dto.refValues as Record<string, unknown> | undefined,
      reference.refValues,
    );

    const wasShared = this.isSharedReference(reference);

    reference.name = resolvedName;
    reference.typeReference = referenceType;
    // Добавляем обработку parentId и isFolder
    if (parentId !== undefined) reference.parentId = parentId;
    if (isFolder !== undefined) reference.isFolder = isFolder;

    const effectiveRefValues = dto.refValues
      ? {
          ...(reference.refValues as unknown as Record<string, unknown>),
          ...(dto.refValues as Record<string, unknown>),
        }
      : reference.refValues;

    // Для HEADGLOBAL + TMZ форсируем enterpriseId = null (аналогично ADMINGLOBAL)
    if (
      userRole === UserRoles.HEADGLOBAL &&
      referenceType === TypeReference.TMZ
    ) {
      reference.enterpriseId = null;
    } else if (
      this.isEnterpriseSharedDirectoryType(referenceType, effectiveRefValues) &&
      userRole !== UserRoles.ADMINGLOBAL
    ) {
      reference.enterpriseId = null;
    } else if (enterpriseId !== undefined) {
      reference.enterpriseId = enterpriseId ?? null;
    }

    if (referenceType === TypeReference.TMZ) {
      const article = this.normalizeArticle(dto.article);
      if (!article || article.length > 15) {
        throw new HttpException(
          "Для TMZ поле article обязательно и должно содержать от 1 до 15 символов",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.checkTMZArticleUnique(
        article,
        reference.enterpriseId ?? null,
        id,
      );
      reference.article = article;
    } else if (referenceType === TypeReference.STORAGES) {
      if (dto.article !== undefined) {
        const article = this.normalizeArticle(dto.article);
        if (!article) {
          (reference as { article?: string | null }).article = null;
        } else if (article.length > 15) {
          throw new HttpException(
            "Для складов/цехов article должен содержать от 1 до 15 символов",
            HttpStatus.BAD_REQUEST,
          );
        } else {
          await this.checkStoragesArticleUnique(
            article,
            reference.enterpriseId ?? null,
            id,
          );
          reference.article = article;
        }
      }
    } else if (referenceType === TypeReference.WORKS) {
      const article = this.normalizeArticle(dto.article);
      if (!article || article.length > 15) {
        throw new HttpException(
          "Для работ поле article обязательно и должно содержать от 1 до 15 символов",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.checkWorksArticleUnique(
        article,
        reference.enterpriseId ?? null,
        id,
      );
      reference.article = article;
    } else if (dto.article !== undefined) {
      reference.article = this.normalizeArticle(dto.article);
    }

    const refValuesPayload: Record<string, unknown> = dto.refValues
      ? { ...(dto.refValues as Record<string, unknown>) }
      : {};
    // Явный null из клиента иначе перезапишет JSONB в NULL и сотрёт вложения ТМЗ
    if (refValuesPayload["filesFromScaling"] === null) {
      delete refValuesPayload["filesFromScaling"];
    }
    if (refValuesPayload["filesFromDrawing"] === null) {
      delete refValuesPayload["filesFromDrawing"];
    }

    // Фильтруем undefined значения перед сохранением (Sequelize не должен получать undefined)
    // Также обрабатываем NaN для числовых полей
    const cleanRefValuesPayload: any = {};
    Object.keys(refValuesPayload).forEach((key) => {
      const value = (refValuesPayload as any)[key];
      if (value !== undefined) {
        // Для числовых полей: NaN не должен попадать в БД
        if (typeof value === "number" && isNaN(value)) {
          // Пропускаем NaN значения - они не будут обновлены
          this.logger.warn(
            `Пропущено NaN значение для поля ${key} в reference ID: ${id}`,
          );
        } else {
          cleanRefValuesPayload[key] = value;
        }
      }
    });

    if (!reference.refValues) {
      reference.refValues = await this.refValuesRepository.create({
        referenceId: reference.id,
        ...cleanRefValuesPayload,
      });
    } else if (dto.refValues) {
      this.logger.log(
        `Обновление RefValues для reference ID: ${id}, данные: ${JSON.stringify(cleanRefValuesPayload)}`,
      );
      try {
        await reference.refValues.update(
          this.normalizeRefValuesPayload(cleanRefValuesPayload),
        );
      } catch (error: any) {
        this.logger.error(
          `Ошибка при обновлении RefValues для reference ID: ${id}, данные: ${JSON.stringify(cleanRefValuesPayload)}, ошибка: ${error.message}`,
        );
        throw error;
      }
    }
    await reference.save();
    await this.updateRefList(); // Обновляем кэш после изменения

    // Актуальные refValues (в т.ч. JSONB) после update — иначе в ответе PATCH может быть устаревший снимок
    await reference.reload({ include: [RefValues] });

    // WebSocket-уведомления отключены — справочники обновляются только через REST
    return reference;
  }

  async createReference(
    dto: UpdateCreateReferenceDto,
    userRole?: string,
    userEnterpriseId?: number | null,
    userSuperKassir?: boolean,
    options?: { skipCacheRefresh?: boolean; allowByReferencePermission?: boolean },
  ) {
    delete (dto as { tmzDictKey?: unknown }).tmzDictKey;
    const { name, typeReference, parentId, isFolder, enterpriseId } = dto;
    const folderFlag = Boolean(isFolder);

    if (typeReference === TypeReference.TMZ && dto.refValues) {
      const mergedRv = {
        ...(dto.refValues as Record<string, unknown>),
      };
      await this.syncTmzAttributeTextsFromIds(mergedRv, name);
      dto.refValues = mergedRv as UpdateCreateReferenceDto["refValues"];
    }

    const resolvedName = this.resolveReferenceName(
      typeReference,
      folderFlag,
      name,
      dto.refValues as Record<string, unknown> | undefined,
    );

    // Для ADMINGLOBAL устанавливаем enterpriseId = null, так как у ADMINGLOBAL нет своей организации
    let finalEnterpriseId: number | null;

    if (this.isEnterpriseSharedDirectoryType(typeReference, dto.refValues)) {
      finalEnterpriseId = null;
    } else if (userRole === UserRoles.ADMINGLOBAL) {
      finalEnterpriseId = enterpriseId ?? null;
    }
    // Для HEADGLOBAL форсируем enterpriseId = null для TMZ (аналогично ADMINGLOBAL)
    else if (
      userRole === UserRoles.HEADGLOBAL &&
      typeReference === TypeReference.TMZ
    ) {
      finalEnterpriseId = null;
    } else if (typeReference === TypeReference.TMZ) {
      // DRAWING и прочие не-глобальные роли: карточка ТМЗ на предприятие пользователя
      finalEnterpriseId = userEnterpriseId ?? enterpriseId ?? null;
    }
    // Для пользователей с superKassir разрешаем создание справочников для других организаций (кроме общих типов)
    else if (userSuperKassir === true) {
      finalEnterpriseId = enterpriseId ?? userEnterpriseId ?? null;
    } else {
      // Для остальных пользователей используем enterpriseId из DTO или пользователя
      finalEnterpriseId = enterpriseId ?? userEnterpriseId ?? null;
    }

    // Проверяем права доступа для общих справочников
    if (userRole) {
      this.checkEditPermission(
        null,
        userRole,
        typeReference,
        dto.refValues,
        userEnterpriseId,
        options?.allowByReferencePermission === true,
      );
    }

    if (isTmzAttributeDictionaryType(typeReference)) {
      await this.assertTmzDictionaryNotDuplicate(
        typeReference,
        name,
        finalEnterpriseId,
        (dto.refValues as { typeTMZ?: TypeTMZ })?.typeTMZ,
      );
    } else {
      const existingReference = await this.referenceRepository.findOne({
        where: {
          name: resolvedName,
          typeReference,
          enterpriseId: finalEnterpriseId,
        },
      });

      if (existingReference) {
        throw new HttpException(
          `Справочник с именем "${resolvedName}" и типом "${typeReference}" уже существует`,
          HttpStatus.CONFLICT,
        );
      }
    }

    let article: string | undefined = undefined;
    if (typeReference === TypeReference.TMZ) {
      article = this.normalizeArticle(dto.article);
      if (!article || article.length > 15) {
        throw new HttpException(
          "Для TMZ поле article обязательно и должно содержать от 1 до 15 символов",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.checkTMZArticleUnique(article, finalEnterpriseId);
    } else if (typeReference === TypeReference.STORAGES) {
      const storagesArticle = this.normalizeArticle(dto.article);
      if (storagesArticle) {
        if (storagesArticle.length > 15) {
          throw new HttpException(
            "Для складов/цехов article должен содержать от 1 до 15 символов",
            HttpStatus.BAD_REQUEST,
          );
        }
        await this.checkStoragesArticleUnique(
          storagesArticle,
          finalEnterpriseId,
        );
        article = storagesArticle;
      }
    } else if (typeReference === TypeReference.WORKS) {
      article = this.normalizeArticle(dto.article);
      if (!article || article.length > 15) {
        throw new HttpException(
          "Для работ поле article обязательно и должно содержать от 1 до 15 символов",
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.checkWorksArticleUnique(article, finalEnterpriseId);
    }

    const dictResolvedName = isTmzAttributeDictionaryType(typeReference)
      ? name.trim()
      : resolvedName;

    const tmzDictKey =
      typeReference === TypeReference.TMZ_SHORT_NAME &&
      (dto.refValues as { typeTMZ?: TypeTMZ })?.typeTMZ
        ? buildTmzShortNameDictKey(
            dictResolvedName,
            (dto.refValues as { typeTMZ: TypeTMZ }).typeTMZ,
            finalEnterpriseId,
          )
        : undefined;

    const reference = await this.referenceRepository.create({
      name: dictResolvedName,
      article,
      typeReference,
      parentId,
      isFolder,
      enterpriseId: finalEnterpriseId,
      ...(tmzDictKey ? { tmzDictKey } : {}),
    });

    if (reference) {
      let refValuesPayload: Record<string, unknown> = dto.refValues
        ? { ...(dto.refValues as Record<string, unknown>) }
        : {};
      if (refValuesPayload["filesFromScaling"] === null) {
        delete refValuesPayload["filesFromScaling"];
      }
      if (refValuesPayload["filesFromDrawing"] === null) {
        delete refValuesPayload["filesFromDrawing"];
      }
      refValuesPayload = this.normalizeRefValuesPayload(refValuesPayload);
      reference.refValues = await this.refValuesRepository.create({
        referenceId: reference.id,
        ...refValuesPayload,
      });
      if (dto.refValues) {
        await reference.refValues.update({ ...refValuesPayload });
      }
      if (!options?.skipCacheRefresh) {
        await this.updateRefList(); // Обновляем кэш после создания
      }

      // WebSocket-уведомления отключены — возвращаем созданный справочник
      return reference;
    }
    throw new HttpException(
      "Ошибка при создании справочника",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Массовое создание справочников: кэш refList обновляется один раз в конце.
   */
  async createManyReferences(
    items: UpdateCreateReferenceDto[],
    userRole?: string,
    userEnterpriseId?: number | null,
    userSuperKassir?: boolean,
    allowByReferencePermission = false,
  ): Promise<{
    created: number;
    skipped: number;
    errors: string[];
    items: Array<{ name: string; id?: number; error?: string }>;
  }> {
    const summary = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
      items: [] as Array<{ name: string; id?: number; error?: string }>,
    };

    for (const dto of items) {
      const name = (dto?.name || "").trim() || "(без имени)";
      try {
        const reference = await this.createReference(
          dto,
          userRole,
          userEnterpriseId,
          userSuperKassir,
          { skipCacheRefresh: true, allowByReferencePermission },
        );
        summary.created += 1;
        summary.items.push({ name, id: reference.id });
      } catch (err: any) {
        const message =
          err?.response?.message ||
          err?.message ||
          "Ошибка при создании справочника";
        const text = Array.isArray(message) ? message.join("; ") : String(message);
        summary.skipped += 1;
        summary.errors.push(`${name}: ${text}`);
        summary.items.push({ name, error: text });
      }
    }

    await this.updateRefList();
    return summary;
  }

  // Поля refValues, которые НЕ копируются "как есть" при дублировании.
  // imagePath* обрабатываются отдельно: физически копируем файлы (см. copyProductImageFile),
  // чтобы у дубликата были собственные независимые изображения.
  private static readonly DUPLICATE_EXCLUDED_REF_VALUES_FIELDS = [
    "id",
    "referenceId",
    "createdAt",
    "updatedAt",
    "markToDeleted",
    "imagePath",
    "imagePath2",
    "imagePath3",
    "showOnWebsite",
    "websiteDescription",
  ];

  private static readonly DUPLICATE_IMAGE_FIELDS = [
    "imagePath",
    "imagePath2",
    "imagePath3",
  ] as const;

  /**
   * Физически копирует файл изображения товара в uploads/images/products
   * под новым уникальным именем и возвращает новое имя файла.
   * Если исходный файл отсутствует или копирование не удалось — возвращает null.
   */
  private copyProductImageFile(sourceFilename: string): string | null {
    try {
      const name = String(sourceFilename || "").trim();
      if (!name) return null;
      const dir = join(process.cwd(), "uploads/images/products");
      const sourcePath = join(dir, name);
      if (!fs.existsSync(sourcePath)) return null;
      const ext = extname(name);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const newFilename = `product-${uniqueSuffix}${ext}`;
      fs.copyFileSync(sourcePath, join(dir, newFilename));
      return newFilename;
    } catch (err) {
      this.logger.error(
        `Не удалось скопировать изображение "${sourceFilename}" для дубликата: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * Дублировать справочник: копирует карточку (refValues с изображениями, но без полей сайта),
   * генерирует новый артикул и, для готовой продукции (TMZ PRODUCT), копирует нормы
   * (работы/материалы/техкарта/состав). Запись создаётся сразу в БД.
   */
  async duplicateReference(
    id: number,
    userRole?: string,
    userEnterpriseId?: number | null,
  ) {
    const source = await this.referenceRepository.findOne({
      where: { id },
      include: [RefValues],
    });
    if (!source) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    // Права как при редактировании/создании справочника
    if (userRole) {
      this.checkEditPermission(
        source,
        userRole,
        source.typeReference,
        source.refValues,
        userEnterpriseId,
      );
    }

    // enterpriseId дубликата: для HEADGLOBAL + TMZ форсируем null, иначе как у источника
    let finalEnterpriseId: number | null = source.enterpriseId ?? null;
    if (
      userRole === UserRoles.HEADGLOBAL &&
      source.typeReference === TypeReference.TMZ
    ) {
      finalEnterpriseId = null;
    }

    // Копия refValues без id/служебных полей и без изображений/полей сайта
    const sourceRv = source.refValues
      ? (source.refValues.toJSON() as unknown as Record<string, unknown>)
      : {};
    const refValuesPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sourceRv)) {
      if (
        ReferencesService.DUPLICATE_EXCLUDED_REF_VALUES_FIELDS.includes(key)
      ) {
        continue;
      }
      if (value === undefined) continue;
      refValuesPayload[key] = value;
    }

    // Изображения: физически копируем файлы, чтобы у дубликата были свои копии
    for (const field of ReferencesService.DUPLICATE_IMAGE_FIELDS) {
      const sourceImage = sourceRv[field];
      if (typeof sourceImage === "string" && sourceImage.trim()) {
        const copiedFilename = this.copyProductImageFile(sourceImage);
        if (copiedFilename) {
          refValuesPayload[field] = copiedFilename;
        }
      }
    }

    const typeTMZ = refValuesPayload.typeTMZ as TypeTMZ | undefined;

    // Новый артикул
    let article: string | undefined = undefined;
    if (source.typeReference === TypeReference.TMZ) {
      const sourceArticle = (source.article ?? "").trim();
      const prefix = (sourceArticle.split("-")[0] || sourceArticle.slice(0, 2))
        .trim()
        .toUpperCase();
      try {
        article = await nextTmzArticleString(
          this.referenceRepository as any,
          prefix,
          finalEnterpriseId,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось сформировать артикул";
        throw new HttpException(
          `Не удалось сформировать новый артикул для дубликата: ${message}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } else if (source.typeReference === TypeReference.WORKS) {
      const sourceArticle = (source.article ?? "").trim();
      const prefix = sourceArticle.replace(/\d+$/, "");
      if (prefix) {
        try {
          article = await nextWorksArticleString(
            this.referenceRepository as any,
            prefix,
            finalEnterpriseId,
          );
        } catch {
          article = undefined;
        }
      }
    }

    const newName = `${source.name} (нусха)`;

    const tmzDictKey =
      source.typeReference === TypeReference.TMZ_SHORT_NAME && typeTMZ
        ? buildTmzShortNameDictKey(newName.trim(), typeTMZ, finalEnterpriseId)
        : undefined;

    // Создаём карточку + refValues атомарно
    const sequelize = this.referenceRepository.sequelize;
    if (!sequelize) {
      throw new HttpException(
        "Не удалось получить подключение к БД",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const created = await sequelize.transaction(async (transaction) => {
      const ref = await this.referenceRepository.create(
        {
          name: newName,
          article,
          typeReference: source.typeReference,
          parentId: source.parentId,
          isFolder: source.isFolder,
          enterpriseId: finalEnterpriseId,
          ...(tmzDictKey ? { tmzDictKey } : {}),
        } as any,
        { transaction },
      );
      await this.refValuesRepository.create(
        this.normalizeRefValuesPayload({
          ...refValuesPayload,
          referenceId: ref.id,
        }) as any,
        { transaction },
      );
      return ref;
    });

    await this.updateRefList();

    // Копируем нормы для готовой продукции (TMZ PRODUCT, не папка)
    if (
      source.typeReference === TypeReference.TMZ &&
      typeTMZ === TypeTMZ.PRODUCT &&
      !source.isFolder
    ) {
      try {
        const bundle = await this.productNormsService.getBundle(id);
        const dto: ReplaceProductNormsDto = {
          works: (bundle.works ?? []).map((w: any, i: number) => ({
            lineIndex: w.lineIndex ?? i,
            workName: w.workName,
            workArticle: w.workArticle,
            unit: w.unit,
            countInUnit: w.countInUnit,
            countInOrder: w.countInOrder,
            timeInUnit: w.timeInUnit,
            timeInOrder: w.timeInOrder,
            salaryInUnit: w.salaryInUnit,
            salaryInOrder: w.salaryInOrder,
            assignedDeptId: w.assignedDeptId,
            workRefId: w.workRefId,
            salaryRate: w.salaryRate,
            hourRate: w.hourRate,
          })),
          materials: (bundle.materials ?? []).map((m: any, i: number) => ({
            lineIndex: m.lineIndex ?? i,
            materialId: Number(m.materialId),
            price: m.price,
            countPlanned: m.countPlanned,
            total: m.total,
          })),
          routes: (bundle.routes ?? []).map((r: any) => ({
            sequence: Number(r.sequence),
            deptId: Number(r.deptId),
          })),
          components: (bundle.components ?? []).map((c: any) => ({
            componentReferenceId: Number(c.componentReferenceId),
            qty: Number(c.qty),
          })),
        };
        if (
          dto.works?.length ||
          dto.materials?.length ||
          dto.routes?.length ||
          dto.components?.length
        ) {
          await this.productNormsService.replaceAll(created.id, dto);
        }
      } catch (err) {
        this.logger.error(
          `Не удалось скопировать нормы для дубликата ${created.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const result = await this.referenceRepository.findOne({
      where: { id: created.id },
      include: [RefValues],
    });
    return result;
  }

  async markToDeleteById(id: number, userRole?: string) {
    const reference = await this.referenceRepository.findOne({
      where: { id },
      include: [RefValues],
    });

    if (!reference) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    this.ensureDeletePermission(reference, userRole);

    reference.refValues.markToDeleted = !reference.refValues.markToDeleted;
    await reference.refValues.save();
    await this.updateRefList(); // Обновляем кэш после изменения
    return reference;
  }

  /**
   * Полностью удалить из БД всех партнёров, импортированных из Excel (importedFromXlsx).
   * Сначала удаляет связанные rental_contracts по clientId.
   */
  async deleteImportedPartnersPermanent(userRole?: string): Promise<{
    deletedPartners: number;
    deletedContracts: number;
    skipped: number;
    total: number;
    errors: string[];
  }> {
    if (userRole !== UserRoles.ADMINGLOBAL) {
      throw new HttpException(
        "Только ADMINGLOBAL может полностью удалять импортированных партнёров",
        HttpStatus.FORBIDDEN,
      );
    }

    const refs = await this.referenceRepository.findAll({
      where: {
        typeReference: TypeReference.PARTNERS,
        isFolder: false,
      },
      include: [
        {
          model: RefValues,
          required: true,
          where: { importedFromXlsx: true },
        },
      ],
    });

    const ids = refs.map((r) => r.id).filter((id): id is number => id != null);
    const result = {
      deletedPartners: 0,
      deletedContracts: 0,
      skipped: 0,
      total: ids.length,
      errors: [] as string[],
    };

    if (!ids.length) {
      return result;
    }

    const sequelize = this.referenceRepository.sequelize;
    if (!sequelize) {
      throw new HttpException(
        "Не удалось получить подключение к БД",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await sequelize.transaction(async (transaction) => {
      const [, contractsMeta] = await sequelize.query(
        `DELETE FROM rental_contracts WHERE "clientId" IN (:ids)`,
        {
          replacements: { ids },
          transaction,
        },
      );
      const deletedContracts =
        typeof contractsMeta === "number"
          ? contractsMeta
          : Number((contractsMeta as { rowCount?: number })?.rowCount ?? 0);
      result.deletedContracts = Number.isFinite(deletedContracts)
        ? deletedContracts
        : 0;
    });

    // Партнёров удаляем по одному: ошибка одного не откатывает остальных
    for (const ref of refs) {
      const id = ref.id;
      if (id == null) continue;
      try {
        await sequelize.transaction(async (transaction) => {
          await this.refValuesRepository.destroy({
            where: { referenceId: id },
            transaction,
          });
          await this.referenceRepository.destroy({
            where: { id },
            transaction,
          });
        });
        result.deletedPartners += 1;
      } catch (err: any) {
        result.skipped += 1;
        result.errors.push(
          `${ref.name}: ${err?.message || "ошибка удаления (возможны связи в документах)"}`,
        );
      }
    }

    await this.updateRefList();
    return result;
  }

  private ensureDeletePermission(reference: Reference, userRole?: string): void {
    if (reference.enterpriseId !== null) {
      return;
    }

    const canDeleteNullEnterprise =
      userRole === UserRoles.ADMINGLOBAL ||
      userRole === UserRoles.HEADCOMPANY ||
      (userRole === UserRoles.HEADGLOBAL &&
        reference.typeReference === TypeReference.TMZ);

    if (!canDeleteNullEnterprise) {
      throw new HttpException(
        "Только администратор или руководитель предприятия может удалять справочники с незаданной организацией",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async getReferenceUsage(referenceId: number): Promise<ReferenceUsageSummary> {
    const reference = await this.referenceRepository.findByPk(referenceId);
    if (!reference) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    const dictFields: ReferenceUsageField[] = [
      "shortNameId",
      "sizeId",
      "colorId",
      "textureId",
      "manufactureId",
      "unitId",
    ];

    const inReferences: ReferenceUsageInReference[] = [];
    for (const field of dictFields) {
      const rows = await this.referenceRepository.findAll({
        include: [
          {
            model: RefValues,
            required: true,
            where: {
              [field]: referenceId,
            },
          },
        ],
      });
      for (const row of rows) {
        if (!row.id || row.id === referenceId) continue;
        inReferences.push({
          referenceId: row.id,
          name: row.name,
          article: row.article ?? null,
          typeReference: row.typeReference,
          field,
        });
      }
    }

    const docValueFields = [
      "senderId",
      "receiverId",
      "analiticId",
      "productForChargeId",
      "carId",
      "senderPersonId",
      "materialResponsiblePersonId",
      "partnerId",
      "mediatorId",
      "delivererId",
    ] as const;

    const docValueRows = await this.docValuesRepository.findAll({
      where: {
        [Op.or]: docValueFields.map((field) => ({ [field]: referenceId })),
      },
      include: [
        {
          model: Document,
          required: false,
        },
      ],
    });

    const inDocuments: ReferenceUsageInDocument[] = [];
    for (const row of docValueRows) {
      for (const field of docValueFields) {
        if ((row as unknown as Record<string, unknown>)[field] !== referenceId) {
          continue;
        }
        inDocuments.push({
          documentId: row.docId,
          documentType: row.document?.documentType ?? null,
          date: row.document?.date ?? null,
          field,
        });
      }
    }

    const docTableRows = await this.docTableItemsRepository.findAll({
      where: {
        analiticId: referenceId,
      },
      include: [
        {
          model: Document,
          required: false,
        },
      ],
    });

    for (const row of docTableRows) {
      inDocuments.push({
        documentId: row.docId,
        documentType: row.document?.documentType ?? null,
        date: row.document?.date ?? null,
        field: "analiticId",
      });
    }

    const inRelated: ReferenceUsageInRelated[] = [];

    const rentalRows = await this.rentalContractRepository.findAll({
      where: { clientId: referenceId },
      attributes: ["id", "contractNumber", "clientId"],
    });
    this.appendRelatedUsage(
      inRelated,
      rentalRows,
      "rental_contracts",
      ["clientId"],
      referenceId,
      (row) => String(row.contractNumber ?? `#${row.id}`),
    );

    const clientContractRows = await this.clientContractRepository.findAll({
      where: { clientId: referenceId },
      attributes: ["id", "contractNumber", "clientId"],
    });
    this.appendRelatedUsage(
      inRelated,
      clientContractRows,
      "client_contracts",
      ["clientId"],
      referenceId,
      (row) => String(row.contractNumber ?? `#${row.id}`),
    );

    const furnitureRows = await this.furnitureOrderRepository.findAll({
      where: {
        [Op.or]: [{ clientId: referenceId }, { analiticId: referenceId }],
      },
      attributes: ["id", "orderNumber", "clientId", "analiticId"],
    });
    this.appendRelatedUsage(
      inRelated,
      furnitureRows,
      "furniture_orders",
      ["clientId", "analiticId"],
      referenceId,
      (row) => String(row.orderNumber ?? `#${row.id}`),
    );

    const clientBatchRows = await this.clientToolOpenBatchRepository.findAll({
      where: { clientId: referenceId },
      attributes: ["id", "clientId", "transferDocId"],
    });
    this.appendRelatedUsage(
      inRelated,
      clientBatchRows,
      "client_tool_open_batches",
      ["clientId"],
      referenceId,
      (row) =>
        row.transferDocId != null
          ? `doc #${row.transferDocId}`
          : `#${row.id}`,
    );

    const subleaseBatchRows = await this.subleaseToolOpenBatchRepository.findAll(
      {
        where: {
          [Op.or]: [{ clientId: referenceId }, { partnerId: referenceId }],
        },
        attributes: ["id", "clientId", "partnerId", "transferDocId"],
      },
    );
    this.appendRelatedUsage(
      inRelated,
      subleaseBatchRows,
      "sublease_tool_open_batches",
      ["clientId", "partnerId"],
      referenceId,
      (row) =>
        row.transferDocId != null
          ? `doc #${row.transferDocId}`
          : `#${row.id}`,
    );

    const counts = {
      inReferences: inReferences.length,
      inDocuments: inDocuments.length,
      inRelated: inRelated.length,
      total: inReferences.length + inDocuments.length + inRelated.length,
    };

    return {
      referenceId,
      inReferences,
      inDocuments,
      inRelated,
      counts,
      canDelete: counts.total === 0,
    };
  }

  private appendRelatedUsage<T extends { id: number | string }>(
    inRelated: ReferenceUsageInRelated[],
    rows: T[],
    source: string,
    fields: string[],
    referenceId: number,
    labelOf: (row: T) => string,
  ): void {
    for (const row of rows) {
      const data = row as unknown as Record<string, unknown>;
      for (const field of fields) {
        if (Number(data[field]) !== Number(referenceId)) continue;
        inRelated.push({
          source,
          id: Number(row.id),
          label: labelOf(row),
          field,
        });
      }
    }
  }

  async deleteReferencePermanentById(id: number, userRole?: string) {
    const reference = await this.referenceRepository.findOne({
      where: { id },
      include: [RefValues],
    });
    if (!reference) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    this.ensureDeletePermission(reference, userRole);

    const usage = await this.getReferenceUsage(id);
    if (!usage.canDelete) {
      throw new HttpException(
        {
          message: "Нельзя удалить справочник: обнаружены связи",
          usage,
        },
        HttpStatus.CONFLICT,
      );
    }

    const sequelize = this.referenceRepository.sequelize;
    if (!sequelize) {
      throw new HttpException(
        "Не удалось получить подключение к БД",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      await sequelize.transaction(async (transaction) => {
        await this.refValuesRepository.destroy({
          where: { referenceId: id },
          transaction,
        });
        await this.referenceRepository.destroy({
          where: { id },
          transaction,
        });
      });
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const message = String((err as { message?: string })?.message ?? "");
      if (
        err instanceof ForeignKeyConstraintError ||
        name === "SequelizeForeignKeyConstraintError" ||
        message.includes("foreign key constraint")
      ) {
        throw new HttpException(
          "ўчириб бўлмайди: боғланишлар мавжуд",
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    await this.updateRefList();
    return { success: true, id };
  }

  async createMany(list: any) {
    if (list && list.length) {
      for (const item of list) {
        const element = convertJsonRef(item);
        const dto = { ...element };
        try {
          // Проверяем, не существует ли уже запись с таким именем и типом
          const existingReference = await this.referenceRepository.findOne({
            where: {
              name: dto.name,
              typeReference: dto.typeReference,
            },
          });

          if (existingReference) {
            continue;
          }

          const reference = await this.referenceRepository.create({
            name: dto.name,
            typeReference: dto.typeReference,
            parentId: dto.parentId,
            isFolder: dto.isFolder,
            // oldId: dto.oldId,
          });

          if (reference) {
            reference.refValues = await this.refValuesRepository.create({
              referenceId: reference.id,
            });
            const dtoRefV = this.normalizeRefValuesPayload({
              ...(dto.refValues as Record<string, unknown>),
            });
            delete dtoRefV.referenceId;
            await reference.refValues.update({ ...dtoRefV });
          }
        } catch (err) {
          console.error(
            `Ошибка при создании справочника "${dto.name}":`,
            err.message,
          );
          // Продолжаем создание других записей вместо полной остановки
          continue;
        }
      }
      await this.updateRefList(); // Обновляем кэш после массового создания
    }
  }

  /**
   * Найти или создать автомобиль по госномеру
   * Используется системой КПП для автоматического создания автомобилей
   */
  async findOrCreateCarByPlateNumber(plateNumber: string): Promise<Reference> {
    this.logger.log(`Поиск автомобиля по госномеру: ${plateNumber}`);

    // Поиск существующего автомобиля
    const existingCar = await this.referenceRepository.findOne({
      where: {
        typeReference: TypeReference.CARS,
        name: plateNumber,
      },
      include: [RefValues],
    });

    if (existingCar) {
      this.logger.log(
        `Найден существующий автомобиль: ${plateNumber} (ID: ${existingCar.id})`,
      );
      return existingCar;
    }

    // Создание нового автомобиля
    this.logger.log(`Создание нового автомобиля: ${plateNumber}`);

    const timestamp = Date.now();
    const newCar = await this.referenceRepository.create({
      name: plateNumber,
      typeReference: TypeReference.CARS,
    });

    // Создание связанных RefValues
    await this.refValuesRepository.create({
      referenceId: newCar.id,
      carType: CarType?.STRANGER,
      comment: "Автоматически создан системой КПП",
    });

    // Обновляем кэш
    await this.updateRefList();

    this.logger.log(
      `Создан новый автомобиль: ${plateNumber} (ID: ${newCar.id})`,
    );
    return newCar;
  }

  async previewNextTmzArticle(
    prefix: string,
    enterpriseId?: number | null,
    excludeReferenceId?: number,
  ): Promise<string> {
    try {
      return await nextTmzArticleString(
        this.referenceRepository as any,
        prefix,
        enterpriseId ?? null,
        excludeReferenceId,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сформировать артикул";
      if (message.includes("Prefix must be")) {
        throw new HttpException(
          "Префикс артикула: ровно 2 латинские буквы (например MB)",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (message.includes("No free TMZ")) {
        throw new HttpException(
          "Нет свободных номеров артикула (1–9999) для данного префикса",
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  async previewNextWorksArticle(
    prefix: string,
    enterpriseId?: number | null,
    excludeReferenceId?: number,
  ): Promise<string> {
    try {
      return await nextWorksArticleString(
        this.referenceRepository as any,
        prefix,
        enterpriseId ?? null,
        excludeReferenceId,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сформировать артикул";
      if (message.includes("Prefix must be")) {
        throw new HttpException(
          "Префикс артикула: G и 3 цифры (например G006)",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (message.includes("No free WORKS")) {
        throw new HttpException(
          "Нет свободных номеров артикула (001–999) для данной группы",
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
