import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, Transaction } from "sequelize";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import {
  TypePartners,
  TypeReference,
  TypeTMZ,
} from "src/interfaces/reference.interface";
import { ClientContract } from "./clientContract.model";
import { ClientContractOrderLine } from "./clientContractOrderLine.model";
import { ClientContractExpenseLine } from "./clientContractExpenseLine.model";
import { ClientContractItemLine } from "./clientContractItemLine.model";
import { CreateClientContractDto } from "./dto/create-client-contract.dto";
import { UpdateClientContractDto } from "./dto/update-client-contract.dto";
import { ClientContractItemLineDto } from "./dto/client-contract-item-line.dto";
import {
  documentTypeForItemKind,
  isHeaderSaleKind,
  qtyPriceFromFurnitureOrder,
  typeTmzForItemKind,
} from "./client-contracts.utils";
import { nextSequentialYearString } from "src/common/numbering/nextSequentialYearNumber";
import {
  ClientContractItemKind,
  ClientContractStatus,
} from "src/interfaces/client-contract.interface";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { DocumentsService } from "src/documents/documents.service";
import { UsersService } from "src/users/users.service";
import { ReferencesService } from "src/references/references.service";
import { AttachSaleToContractLineDto } from "./dto/create-sale-from-contract.dto";

const contractIncludeFull = [
  { model: Reference, as: "client" },
  {
    model: ClientContractOrderLine,
    include: [
      {
        model: FurnitureOrder,
        as: "furnitureOrder",
        include: [{ model: Reference, as: "analitic" }],
      },
    ],
  },
  { model: ClientContractExpenseLine },
  {
    model: ClientContractItemLine,
    include: [{ model: Reference, as: "analitic" }],
  },
];

@Injectable()
export class ClientContractsService {
  constructor(
    @InjectModel(ClientContract)
    private readonly contractModel: typeof ClientContract,
    @InjectModel(ClientContractOrderLine)
    private readonly orderLineModel: typeof ClientContractOrderLine,
    @InjectModel(ClientContractExpenseLine)
    private readonly expenseLineModel: typeof ClientContractExpenseLine,
    @InjectModel(ClientContractItemLine)
    private readonly itemLineModel: typeof ClientContractItemLine,
    @InjectModel(FurnitureOrder)
    private readonly furnitureOrderModel: typeof FurnitureOrder,
    @InjectModel(Reference)
    private readonly referenceModel: typeof Reference,
    @InjectModel(Document)
    private readonly documentModel: typeof Document,
    @InjectModel(DocTableItems)
    private readonly docTableItemsModel: typeof DocTableItems,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly referencesService: ReferencesService,
  ) {}

  private async assertPartnerClient(clientId: number): Promise<void> {
    const ref = await this.referenceModel.findByPk(clientId, {
      include: [{ model: RefValues, required: false }],
    });
    if (!ref) {
      throw new BadRequestException("Клиент не найден");
    }
    if (ref.typeReference !== TypeReference.PARTNERS) {
      throw new BadRequestException(
        "Клиент договора должен быть из справочника «Партнёры»",
      );
    }
    if (ref.refValues?.typePartners !== TypePartners.CLIENTS) {
      throw new BadRequestException("Выберите партнёра с типом «Клиенты»");
    }
    if (ref.isFolder) {
      throw new BadRequestException("Нельзя выбрать папку справочника");
    }
  }

  private async assertOrdersMatchContract(
    clientId: number,
    enterpriseId: number | null | undefined,
    orderLines: { furnitureOrderId: number }[],
    transaction?: Transaction,
  ): Promise<void> {
    const ids = [...new Set(orderLines.map((l) => l.furnitureOrderId))];
    if (ids.length === 0) return;
    const orders = await this.furnitureOrderModel.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
    });
    if (orders.length !== ids.length) {
      throw new BadRequestException("Одна из заявок не найдена");
    }
    for (const o of orders) {
      if (o.clientId !== clientId) {
        throw new BadRequestException(
          `Заявка ${o.orderNumber} принадлежит другому клиенту`,
        );
      }
      if (
        enterpriseId != null &&
        o.enterpriseId != null &&
        o.enterpriseId !== enterpriseId
      ) {
        throw new BadRequestException(
          `Заявка ${o.orderNumber} относится к другому предприятию`,
        );
      }
    }
  }

  private uniqueOrderLineIds(lines: { furnitureOrderId: number }[]): void {
    const seen = new Set<number>();
    for (const l of lines) {
      if (seen.has(l.furnitureOrderId)) {
        throw new BadRequestException("Заявка в табличной части повторяется");
      }
      seen.add(l.furnitureOrderId);
    }
  }

  private async assertItemLines(
    lines: ClientContractItemLineDto[],
  ): Promise<void> {
    if (!lines.length) return;
    const ids = [...new Set(lines.map((l) => l.analiticId))];
    const refs = await this.referenceModel.findAll({
      where: { id: { [Op.in]: ids } },
      include: [{ model: RefValues, required: false }],
    });
    const byId = new Map(refs.map((r) => [Number(r.id), r]));
    for (const line of lines) {
      const ref = byId.get(Number(line.analiticId));
      if (!ref) {
        throw new BadRequestException("Номенклатура строки не найдена");
      }
      if (ref.isFolder) {
        throw new BadRequestException("Нельзя выбрать папку справочника");
      }
      if (line.lineKind === ClientContractItemKind.SERVICE) {
        if (ref.typeReference !== TypeReference.SERVICES) {
          throw new BadRequestException(
            "Для услуги выберите элемент справочника «Хизмат тури»",
          );
        }
        continue;
      }
      if (ref.typeReference !== TypeReference.TMZ) {
        throw new BadRequestException("Для ТМЦ выберите элемент справочника ТМЗ");
      }
      const expected = typeTmzForItemKind(line.lineKind);
      const actual = ref.refValues?.typeTMZ as TypeTMZ | undefined;
      if (expected && actual !== expected) {
        throw new BadRequestException(
          `Номенклатура не соответствует типу строки (${line.lineKind})`,
        );
      }
    }
  }

  async findAll(
    enterpriseId?: number,
    dateStart?: number,
    dateEnd?: number,
  ): Promise<ClientContract[]> {
    const where: Record<string, unknown> = {};
    if (enterpriseId != null) {
      where.enterpriseId = enterpriseId;
    }
    const ds = dateStart != null ? Number(dateStart) : NaN;
    const de = dateEnd != null ? Number(dateEnd) : NaN;
    if (Number.isFinite(ds) && Number.isFinite(de)) {
      where.contractDate = { [Op.between]: [ds, de] };
    }
    return this.contractModel.findAll({
      where,
      include: [
        { model: Reference, as: "client" },
        {
          model: ClientContractOrderLine,
          include: [
            {
              model: FurnitureOrder,
              as: "furnitureOrder",
              attributes: ["id", "count", "price", "total"],
            },
          ],
        },
        { model: ClientContractExpenseLine },
        { model: ClientContractItemLine },
      ],
      order: [["contractDate", "DESC"]],
      subQuery: false,
    });
  }

  private async attachSaleDocs(
    row: ClientContract,
    transaction?: Transaction,
  ): Promise<ClientContract> {
    const ids = [
      ...(row.itemLines ?? []).map((l) => Number(l.saleDocId || 0)),
      ...(row.orderLines ?? []).map((l) => Number(l.saleDocId || 0)),
      ...(row.orderLines ?? []).map((l) =>
        Number(l.furnitureOrder?.saleDocId || 0),
      ),
    ].filter((id) => id > 0);
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return row;
    const docs = await this.documentModel.findAll({
      where: { id: { [Op.in]: uniqueIds } },
      include: [{ model: DocValues, required: false }],
      transaction,
    });
    const byId = new Map(docs.map((d) => [Number(d.id), d]));
    const assign = (line: { saleDocId?: number | null }, fallbackId?: number) => {
      const id = Number(line.saleDocId || fallbackId || 0);
      const doc = id > 0 ? byId.get(id) ?? null : null;
      (line as { saleDoc?: Document | null }).saleDoc = doc;
      if (typeof (line as ClientContractItemLine).setDataValue === "function") {
        (line as ClientContractItemLine).setDataValue("saleDoc", doc as any);
      }
    };
    for (const line of row.itemLines ?? []) {
      assign(line);
    }
    for (const line of row.orderLines ?? []) {
      assign(line, Number(line.furnitureOrder?.saleDocId || 0));
    }
    return row;
  }

  async findOne(
    id: number,
    options?: { transaction?: Transaction },
  ): Promise<ClientContract> {
    const row = await this.contractModel.findByPk(id, {
      include: contractIncludeFull as any,
      transaction: options?.transaction,
      subQuery: false,
    });
    if (!row) {
      throw new NotFoundException("Договор не найден");
    }
    return this.attachSaleDocs(row, options?.transaction);
  }

  async previewNextNumber(
    enterpriseId: number | null,
    year: number,
  ): Promise<string> {
    return nextSequentialYearString(
      this.contractModel as any,
      "contractNumber",
      enterpriseId,
      year,
    );
  }

  async create(dto: CreateClientContractDto): Promise<ClientContract> {
    const orderLines = dto.orderLines ?? [];
    const itemLines = dto.itemLines ?? [];
    await this.assertPartnerClient(dto.clientId);
    this.uniqueOrderLineIds(orderLines);
    await this.assertOrdersMatchContract(
      dto.clientId,
      dto.enterpriseId,
      orderLines,
    );
    await this.assertItemLines(itemLines);
    const sequelize = this.contractModel.sequelize!;
    return sequelize.transaction(async (t) => {
      const year = new Date(Number(dto.contractDate)).getFullYear();
      const provided = (dto.contractNumber ?? "").trim();
      const contractNumber = provided
        ? provided
        : await nextSequentialYearString(
            this.contractModel as any,
            "contractNumber",
            dto.enterpriseId ?? null,
            year,
            t,
          );
      const contract = await this.contractModel.create(
        {
          enterpriseId: dto.enterpriseId ?? null,
          contractNumber,
          clientId: dto.clientId,
          contractDate: dto.contractDate,
          status: dto.status ?? ClientContractStatus.DRAFT,
        } as any,
        { transaction: t },
      );
      await this.persistChildLines(
        contract.id,
        { ...dto, orderLines, itemLines },
        t,
      );
      return this.findOne(contract.id, { transaction: t });
    });
  }

  async update(
    id: number,
    dto: UpdateClientContractDto,
  ): Promise<ClientContract> {
    const existing = await this.contractModel.findByPk(id);
    if (!existing) {
      throw new NotFoundException("Договор не найден");
    }
    const merged: CreateClientContractDto = {
      enterpriseId: dto.enterpriseId ?? existing.enterpriseId ?? undefined,
      contractNumber: dto.contractNumber ?? existing.contractNumber,
      clientId: dto.clientId ?? existing.clientId,
      contractDate: dto.contractDate ?? existing.contractDate,
      status: dto.status ?? existing.status,
      orderLines: dto.orderLines,
      itemLines: dto.itemLines,
      expenseLines: dto.expenseLines,
    };
    if (merged.orderLines === undefined) {
      const oldLines = await this.orderLineModel.findAll({
        where: { contractId: id },
      });
      merged.orderLines = oldLines.map((l) => ({
        furnitureOrderId: l.furnitureOrderId,
        orderPrice: l.orderPrice,
        count: Number(l.qty) > 0 ? Number(l.qty) : 1,
        saleDocId: l.saleDocId ?? null,
      }));
    }
    if (merged.itemLines === undefined) {
      const oldItems = await this.itemLineModel.findAll({
        where: { contractId: id },
      });
      merged.itemLines = oldItems.map((l) => ({
        id: Number(l.id),
        lineKind: l.lineKind,
        analiticId: l.analiticId,
        count: l.count,
        price: l.price,
        total: l.total,
        saleDocId: l.saleDocId ?? null,
      }));
    }
    const orderLines = merged.orderLines ?? [];
    const itemLines = merged.itemLines ?? [];
    await this.assertPartnerClient(merged.clientId);
    this.uniqueOrderLineIds(orderLines);
    await this.assertOrdersMatchContract(
      merged.clientId,
      merged.enterpriseId,
      orderLines,
    );
    await this.assertItemLines(itemLines);
    const sequelize = this.contractModel.sequelize!;
    return sequelize.transaction(async (t) => {
      await existing.update(
        {
          enterpriseId: merged.enterpriseId ?? null,
          contractNumber: (merged.contractNumber ?? existing.contractNumber).trim(),
          clientId: merged.clientId,
          contractDate: merged.contractDate,
          status: merged.status ?? ClientContractStatus.DRAFT,
        } as any,
        { transaction: t },
      );
      await this.orderLineModel.destroy({
        where: { contractId: id },
        transaction: t,
      });
      await this.itemLineModel.destroy({
        where: { contractId: id },
        transaction: t,
      });
      if (dto.expenseLines !== undefined) {
        await this.expenseLineModel.destroy({
          where: { contractId: id },
          transaction: t,
        });
      }
      await this.persistChildLines(
        id,
        { ...merged, orderLines, itemLines },
        t,
      );
      return this.findOne(id, { transaction: t });
    });
  }

  private async persistChildLines(
    contractId: number,
    dto: CreateClientContractDto,
    t: Transaction,
  ): Promise<void> {
    const orderIds = [
      ...new Set(
        (dto.orderLines ?? []).map((line) => Number(line.furnitureOrderId)),
      ),
    ].filter((id) => id > 0);
    const orders = orderIds.length
      ? await this.furnitureOrderModel.findAll({
          where: { id: { [Op.in]: orderIds } },
          transaction: t,
        })
      : [];
    const orderById = new Map(orders.map((o) => [Number(o.id), o]));
    for (const line of dto.orderLines ?? []) {
      const order = orderById.get(Number(line.furnitureOrderId));
      const live = qtyPriceFromFurnitureOrder(order, {
        count: line.count,
        orderPrice: line.orderPrice,
      });
      await this.orderLineModel.create(
        {
          contractId,
          furnitureOrderId: line.furnitureOrderId,
          orderPrice: live.orderPrice,
          qty: live.count,
          additionalExpenses: 0,
          saleDocId: line.saleDocId ? Number(line.saleDocId) : null,
        } as any,
        { transaction: t },
      );
    }
    for (const line of dto.itemLines ?? []) {
      const count = Number(line.count) || 0;
      const price = Number(line.price) || 0;
      const total =
        line.total != null && Number.isFinite(Number(line.total))
          ? Number(line.total)
          : Number((count * price).toFixed(2));
      await this.itemLineModel.create(
        {
          contractId,
          lineKind: line.lineKind,
          analiticId: line.analiticId,
          count,
          price,
          total,
          saleDocId: line.saleDocId ? Number(line.saleDocId) : null,
        } as any,
        { transaction: t },
      );
    }
    for (const e of dto.expenseLines ?? []) {
      if (!e.expenseName?.trim()) continue;
      await this.expenseLineModel.create(
        {
          contractId,
          expenseName: e.expenseName.trim(),
          amount: Number(e.amount) || 0,
        } as any,
        { transaction: t },
      );
    }
  }

  async remove(id: number): Promise<void> {
    const contract = await this.contractModel.findByPk(id);
    if (!contract) {
      throw new NotFoundException(`Договор ${id} не найден`);
    }
    await contract.destroy();
  }

  async clearSaleDocLinks(docId: number, transaction?: Transaction): Promise<void> {
    await this.itemLineModel.update(
      { saleDocId: null } as any,
      { where: { saleDocId: docId }, transaction },
    );
    await this.orderLineModel.update(
      { saleDocId: null } as any,
      { where: { saleDocId: docId }, transaction },
    );
  }

  private documentHasAnalitic(doc: Document, analiticId: number): boolean {
    const headerId = Number(doc.docValues?.analiticId || 0);
    if (headerId === Number(analiticId)) return true;
    const items = doc.docTableItems ?? [];
    return items.some((it) => Number(it.analiticId) === Number(analiticId));
  }

  private async loadSaleDocument(saleDocId: number): Promise<Document> {
    const doc = await this.documentModel.findByPk(saleDocId, {
      include: [DocValues, DocTableItems],
    });
    if (!doc) {
      throw new BadRequestException("Документ реализации не найден");
    }
    if (doc.docStatus === DocSTATUS.DELETED) {
      throw new BadRequestException("Документ реализации удалён");
    }
    if (doc.docStatus !== DocSTATUS.PROVEDEN) {
      throw new BadRequestException(
        "К договору можно привязать только проведённый документ",
      );
    }
    return doc;
  }

  private assertSaleMatchesContract(
    contract: ClientContract,
    doc: Document,
    expectedType: DocumentType,
    analiticId: number,
    orderId?: number,
  ): void {
    if (doc.documentType !== expectedType) {
      throw new BadRequestException(
        `Тип документа (${doc.documentType}) не подходит для этой строки`,
      );
    }
    if (
      contract.enterpriseId != null &&
      doc.enterpriseId != null &&
      Number(doc.enterpriseId) !== Number(contract.enterpriseId)
    ) {
      throw new BadRequestException("Документ относится к другому предприятию");
    }
    const receiverId = Number(doc.docValues?.receiverId || 0);
    if (receiverId !== Number(contract.clientId)) {
      throw new BadRequestException(
        "Клиент в документе не совпадает с клиентом договора",
      );
    }
    if (orderId) {
      const docOrderId = Number(doc.docValues?.orderId || 0);
      if (docOrderId === Number(orderId)) return;
    }
    if (!this.documentHasAnalitic(doc, analiticId)) {
      throw new BadRequestException(
        "ТМЦ в документе не совпадает со строкой договора",
      );
    }
  }

  private async assertSaleNotBoundToOtherContract(
    saleDocId: number,
    contractId: number,
  ): Promise<void> {
    const [itemBound, orderBound] = await Promise.all([
      this.itemLineModel.findOne({
        where: {
          saleDocId,
          contractId: { [Op.ne]: contractId },
        },
      }),
      this.orderLineModel.findOne({
        where: {
          saleDocId,
          contractId: { [Op.ne]: contractId },
        },
      }),
    ]);
    if (itemBound || orderBound) {
      throw new BadRequestException(
        "Этот документ уже привязан к другому договору",
      );
    }
  }

  async attachSale(
    contractId: number,
    dto: AttachSaleToContractLineDto,
  ): Promise<ClientContract> {
    const contract = await this.findOne(contractId);
    const saleDocId =
      dto.saleDocId != null && Number(dto.saleDocId) > 0
        ? Number(dto.saleDocId)
        : null;

    if (dto.lineType === "order") {
      const line = await this.orderLineModel.findOne({
        where: { id: dto.lineId, contractId },
        include: [{ model: FurnitureOrder, as: "furnitureOrder" }],
      });
      if (!line) throw new NotFoundException("Строка заказа не найдена");
      if (!saleDocId) {
        await line.update({ saleDocId: null } as any);
        return this.findOne(contractId);
      }
      const order = line.furnitureOrder;
      const analiticId = Number(order?.analiticId || 0);
      const tmz = await this.referenceModel.findByPk(analiticId, {
        include: [{ model: RefValues, required: false }],
      });
      const expectedType =
        tmz?.refValues?.typeTMZ === TypeTMZ.HALFSTUFF
          ? DocumentType.SaleHalfStuff
          : DocumentType.SaleProd;
      const doc = await this.loadSaleDocument(saleDocId);
      this.assertSaleMatchesContract(
        contract,
        doc,
        expectedType,
        analiticId,
        Number(line.furnitureOrderId),
      );
      await this.assertSaleNotBoundToOtherContract(saleDocId, contractId);
      await line.update({ saleDocId } as any);
      return this.findOne(contractId);
    }

    const line = await this.itemLineModel.findOne({
      where: { id: dto.lineId, contractId },
    });
    if (!line) throw new NotFoundException("Строка ТМЦ/услуги не найдена");
    if (!saleDocId) {
      await line.update({ saleDocId: null } as any);
      return this.findOne(contractId);
    }
    const expectedType = documentTypeForItemKind(line.lineKind);
    const doc = await this.loadSaleDocument(saleDocId);
    this.assertSaleMatchesContract(
      contract,
      doc,
      expectedType,
      Number(line.analiticId),
    );
    await this.assertSaleNotBoundToOtherContract(saleDocId, contractId);
    await line.update({ saleDocId } as any);
    return this.findOne(contractId);
  }

  async findSaleCandidates(
    contractId: number,
    lineType: "item" | "order",
    lineId: number,
  ) {
    const contract = await this.findOne(contractId);
    let documentType: DocumentType;
    let analiticId: number;
    let orderId: number | undefined;

    if (lineType === "order") {
      const line = await this.orderLineModel.findOne({
        where: { id: lineId, contractId },
        include: [{ model: FurnitureOrder, as: "furnitureOrder" }],
      });
      if (!line) throw new NotFoundException("Строка заказа не найдена");
      analiticId = Number(line.furnitureOrder?.analiticId || 0);
      orderId = Number(line.furnitureOrderId);
      const tmz = await this.referenceModel.findByPk(analiticId, {
        include: [{ model: RefValues, required: false }],
      });
      documentType =
        tmz?.refValues?.typeTMZ === TypeTMZ.HALFSTUFF
          ? DocumentType.SaleHalfStuff
          : DocumentType.SaleProd;
    } else {
      const line = await this.itemLineModel.findOne({
        where: { id: lineId, contractId },
      });
      if (!line) throw new NotFoundException("Строка ТМЦ/услуги не найдена");
      analiticId = Number(line.analiticId);
      documentType = documentTypeForItemKind(line.lineKind);
    }

    const where: Record<string, unknown> = {
      documentType,
      docStatus: { [Op.ne]: DocSTATUS.DELETED },
    };
    if (contract.enterpriseId != null) {
      where.enterpriseId = contract.enterpriseId;
    }

    const docs = await this.documentModel.findAll({
      where,
      include: [
        {
          model: DocValues,
          required: true,
          where: { receiverId: contract.clientId },
        },
        { model: DocTableItems, required: false },
      ],
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      limit: 80,
    });

    return docs
      .filter((doc) => {
        if (orderId && Number(doc.docValues?.orderId || 0) === orderId) {
          return true;
        }
        return this.documentHasAnalitic(doc, analiticId);
      })
      .map((doc) => ({
        id: Number(doc.id),
        date: Number(doc.date),
        documentType: doc.documentType,
        docStatus: doc.docStatus,
        comment: doc.docValues?.comment ?? "",
        total: Number(doc.docValues?.total || 0),
        items: (doc.docTableItems ?? []).map((it) => ({
          analiticId: Number(it.analiticId),
          count: Number(it.count || 0),
          total: Number(it.total || 0),
        })),
        analiticId: Number(doc.docValues?.analiticId || 0),
      }));
  }

  private async resolveSaleSenderId(
    enterpriseId: number,
    kind: ClientContractItemKind,
  ): Promise<number> {
    if (kind === ClientContractItemKind.SERVICE) {
      const production =
        await this.referencesService.findProductionStorageByEnterpriseId(
          enterpriseId,
        );
      if (production) return Number(production.id);
    }
    const product =
      await this.referencesService.findProductStorageByEnterpriseId(enterpriseId);
    if (product) return Number(product.id);
    const common =
      await this.referencesService.findCommonStorageByEnterpriseId(enterpriseId);
    if (common) return Number(common.id);
    throw new BadRequestException(
      "Не найден склад предприятия для документа продажи. Укажите склад в документе.",
    );
  }

  async createSaleDocuments(
    contractId: number,
    userId: number,
    itemLineIds?: number[],
  ): Promise<{ documents: Document[]; contract: ClientContract }> {
    const contract = await this.findOne(contractId);
    const enterpriseId = Number(contract.enterpriseId);
    if (!enterpriseId) {
      throw new BadRequestException("У договора не указано предприятие");
    }
    let lines = contract.itemLines ?? [];
    if (itemLineIds?.length) {
      const idSet = new Set(itemLineIds.map(Number));
      lines = lines.filter((l) => idSet.has(Number(l.id)));
    } else {
      lines = lines.filter((l) => !l.saleDocId);
    }
    lines = lines.filter((l) => Number(l.analiticId) > 0);
    if (!lines.length) {
      throw new BadRequestException("Нет строк для создания реализации");
    }

    const created: Document[] = [];
    const headerLines = lines.filter((l) => isHeaderSaleKind(l.lineKind));
    const tableLines = lines.filter((l) => !isHeaderSaleKind(l.lineKind));

    for (const line of headerLines) {
      if (line.saleDocId) continue;
      const doc = await this.createOneSaleDocument(contract, [line], userId);
      created.push(doc);
      await this.itemLineModel.update(
        { saleDocId: Number(doc.id) } as any,
        { where: { id: line.id } },
      );
    }

    const byKind = new Map<ClientContractItemKind, ClientContractItemLine[]>();
    for (const line of tableLines) {
      if (line.saleDocId) continue;
      const list = byKind.get(line.lineKind) ?? [];
      list.push(line);
      byKind.set(line.lineKind, list);
    }
    for (const group of byKind.values()) {
      if (!group.length) continue;
      const doc = await this.createOneSaleDocument(contract, group, userId);
      created.push(doc);
      await this.itemLineModel.update(
        { saleDocId: Number(doc.id) } as any,
        { where: { id: { [Op.in]: group.map((l) => Number(l.id)) } } },
      );
    }

    return { documents: created, contract: await this.findOne(contractId) };
  }

  private async createOneSaleDocument(
    contract: ClientContract,
    lines: ClientContractItemLine[],
    userId: number,
  ): Promise<Document> {
    const kind = lines[0].lineKind;
    const documentType = documentTypeForItemKind(kind);
    const senderId = await this.resolveSaleSenderId(
      Number(contract.enterpriseId),
      kind,
    );
    const comment = `По договору ${contract.contractNumber}`;
    const lineId = lines.length === 1 ? Number(lines[0].id) : null;

    const created = await this.documentsService.createDocument(
      {
        date: Date.now() as any,
        userId,
        enterpriseId: Number(contract.enterpriseId),
        documentType,
        docStatus: DocSTATUS.OPEN,
        saveOnly: true,
        docValues: {
          senderId,
          receiverId: Number(contract.clientId),
          total: 0,
          comment,
          clientContractId: Math.trunc(Number(contract.id)),
          clientContractLineId:
            lineId != null && Number.isFinite(lineId)
              ? Math.trunc(lineId)
              : null,
        } as any,
        docTableItems: [],
      } as any,
      this.usersService,
      this.referencesService,
    );
    return created as Document;
  }
}
