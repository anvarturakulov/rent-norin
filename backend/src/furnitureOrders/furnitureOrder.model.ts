import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from "sequelize-typescript";
import { Enterprise } from "src/enterprises/enterprise.model";
import { Document } from "src/documents/document.model";
import { Reference } from "src/references/reference.model";
import {
  FurnitureOrderType,
  LEGACY_ORDER_STAGE_VALUES,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";
import { OrderPipelineStage } from "src/orderPipeline/orderPipelineStage.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderHalfstuff } from "src/orderHalfstuffs/orderHalfstuff.model";
import { OrderCommonWork } from "src/orderCommonWorks/orderCommonWork.model";
import { OrderCuttingIssue } from "src/orderCutting/orderCuttingIssue.model";
import { OrderCuttingOutput } from "src/orderCutting/orderCuttingOutput.model";
import { OrderStageHistory } from "src/orderStageHistory/orderStageHistory.model";

export interface FurnitureOrderCreationAttrs {
  enterpriseId?: number | null;
  clientId: number;
  analiticId?: number;
  orderNumber: string;
  orderType?: FurnitureOrderType;
  currentStage?: OrderStageType;
  createdDate: number;
  orderDate?: number;
  deadlineDate?: number;
  count?: number;
  price?: number;
  profitRate?: number;
  profitValue?: number;
  discount?: number;
  total?: number;
  linkedDocId?: number;
  receiptDocId?: number;
  saleDocId?: number;
  materialWriteoffDocId?: number;
  halfstuffWriteoffDocId?: number;
  requiresClientSale?: boolean;
  allowReceiptWithoutFullWriteoff?: boolean;
  filesFromScaling?: string;
  filesFromDrawing?: string;
  filesFromPricing?: string;
  filesFromStore?: string;
  filesFromDelivery?: string;
  comment?: string;
  disabledBeforeCostMarkupCodes?: string[] | null;
  disabledBeforeCostMarkupCodesWorks?: string[] | null;
}

@Table({ tableName: "furniture_orders" })
export class FurnitureOrder extends Model<
  FurnitureOrder,
  FurnitureOrderCreationAttrs
> {
  private static readonly stageEnumValues = [
    ...Object.values(OrderStageType),
    ...LEGACY_ORDER_STAGE_VALUES,
  ];
  @ApiProperty({ example: 1, description: "Уникальный идентификатор" })
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Enterprise)
  @ApiProperty({ example: 1, description: "ID предприятия" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise: Enterprise;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: 1, description: "ID клиента (из справочника)" })
  @Column({ type: DataType.INTEGER, allowNull: false })
  clientId: number;

  @BelongsTo(() => Reference)
  client: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 101,
    description: "ID готовой продукции (аналитика)",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  analiticId?: number;

  @BelongsTo(() => Reference, "analiticId")
  analitic?: Reference;

  @ApiProperty({ example: "ЗМ-2025-001", description: "Номер заявки" })
  @Column({ type: DataType.STRING, allowNull: false })
  orderNumber: string;

  @ApiProperty({
    example: FurnitureOrderType.INDIVIDUAL_PRICE,
    description: "Тип заказа: readyPrice | individualPrice",
    required: false,
  })
  @Column({
    type: DataType.ENUM(...Object.values(FurnitureOrderType)),
    allowNull: true,
    field: "order_type",
  })
  orderType?: FurnitureOrderType;

  @ApiProperty({ example: "TALABGOR", description: "Текущий активный этап" })
  @Column({
    type: DataType.ENUM(...FurnitureOrder.stageEnumValues),
    defaultValue: OrderStageType.TALABGOR,
  })
  currentStage: OrderStageType;

  @ApiProperty({
    example: 1738368000000,
    description: "Дата создания заявки (мс)",
  })
  @Column({ type: DataType.BIGINT, allowNull: false })
  createdDate: number;

  @ApiProperty({
    example: 1738368000000,
    description: "Дата заявки (мс, ручной ввод)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  orderDate?: number;

  @ApiProperty({
    example: 1740000000000,
    description: "Срок выполнения (мс)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  deadlineDate?: number;

  @ApiProperty({
    example: 3,
    description: "Количество изделий",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  count?: number;

  @ApiProperty({
    example: 1200000,
    description: "Цена за единицу (иккинчи нарх)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  price?: number;

  @ApiProperty({
    example: 15,
    description: "Процент прибыли (%)",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  profitRate?: number;

  @ApiProperty({
    example: 500000,
    description: "Сумма прибыли",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  profitValue?: number;

  @ApiProperty({ example: 100000, description: "Скидка", required: false })
  @Column({ type: DataType.FLOAT, allowNull: true })
  discount?: number;

  @ApiProperty({
    example: 3500000,
    description: "Итоговая сумма заявки",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  total?: number;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 12345,
    description: "ID связанного бухгалтерского документа",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  linkedDocId?: number;

  @BelongsTo(() => Document)
  linkedDoc?: Document;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 12346,
    description: "ID документа прихода ГП/ПФ (ComeProduct/ComeHalfstuff)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  receiptDocId?: number;

  @BelongsTo(() => Document, "receiptDocId")
  receiptDoc?: Document;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 12347,
    description: "ID документа отгрузки клиенту (SaleProd/SaleHalfStuff)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  saleDocId?: number;

  @BelongsTo(() => Document, "saleDocId")
  saleDoc?: Document;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 12348,
    description: "ID документа списания материалов (LeaveMaterial) по заказу",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  materialWriteoffDocId?: number;

  @BelongsTo(() => Document, "materialWriteoffDocId")
  materialWriteoffDoc?: Document;

  @ForeignKey(() => Document)
  @ApiProperty({
    example: 12349,
    description: "ID документа списания полуфабрикатов (LeaveHalfstuff) по заказу",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  halfstuffWriteoffDocId?: number;

  @BelongsTo(() => Document, "halfstuffWriteoffDocId")
  halfstuffWriteoffDoc?: Document;

  @ApiProperty({
    example: true,
    description: "Требуется оформить отгрузку клиенту на этапе Омбор",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: true })
  requiresClientSale?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Разрешить приход ГП/ПФ до полного списания материалов и полуфабрикатов по плану",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  allowReceiptWithoutFullWriteoff?: boolean;

  @ApiProperty({
    example: '["/uploads/scale1.jpg"]',
    description: "Файлы со стадии SCALING (JSON)",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  filesFromScaling?: string;

  @ApiProperty({
    example: '["/uploads/draw1.csv"]',
    description: "Файлы со стадии DRAWING (JSON)",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  filesFromDrawing?: string;

  @ApiProperty({
    example: '["/uploads/price1.pdf"]',
    description: "Файлы со стадии PRICING (JSON)",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  filesFromPricing?: string;

  @ApiProperty({
    example: '["/uploads/store1.jpg"]',
    description: "Файлы со стадии STORE (JSON)",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  filesFromStore?: string;

  @ApiProperty({
    example: '["/uploads/delivery1.jpg"]',
    description: "Файлы со стадии DELIVERY (JSON)",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  filesFromDelivery?: string;

  @ApiProperty({
    example: "Кухня для Иванова",
    description: "Комментарий",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  comment?: string;

  @ApiProperty({
    example: ["OTHER_EXPENSES"],
    description:
      "Коды BEFORE_COST наценок, выключенных для колонки Умумий ишлар (пусто = все включены)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  disabledBeforeCostMarkupCodes?: string[] | null;

  @ApiProperty({
    example: ["OTHER_EXPENSES"],
    description:
      "Коды BEFORE_COST наценок, выключенных для колонки Ишлар (пусто = все включены)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  disabledBeforeCostMarkupCodesWorks?: string[] | null;

  @HasMany(() => OrderPipelineStage)
  pipelineStages: OrderPipelineStage[];

  @HasMany(() => OrderProductionQueue)
  productionQueue: OrderProductionQueue[];

  @HasMany(() => OrderWork)
  works: OrderWork[];

  @HasMany(() => OrderMaterial)
  materials: OrderMaterial[];

  @HasMany(() => OrderHalfstuff)
  halfstuffs: OrderHalfstuff[];

  @HasMany(() => OrderCommonWork)
  commonWorks: OrderCommonWork[];

  @HasMany(() => OrderCuttingIssue)
  cuttingIssues: OrderCuttingIssue[];

  @HasMany(() => OrderCuttingOutput)
  cuttingOutputs: OrderCuttingOutput[];

  @HasMany(() => OrderStageHistory)
  stageHistory: OrderStageHistory[];
}
