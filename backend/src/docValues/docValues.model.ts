import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import { Document } from "src/documents/document.model";
import { Reference } from "src/references/reference.model";

export interface DocValuesCreationAttrs {
  docId: bigint;
  senderId: number;
  receiverId: number;
  analiticId?: number;
  productForChargeId?: number;
  isWorker?: boolean;
  isPartner?: boolean;
  isClient?: boolean;
  isFounder?: boolean;
  isDepartment?: boolean;
  isMediator?: boolean;
  isDeliverer?: boolean;
  count?: number;
  price?: number;
  total?: number;
  cashFromPartner?: number;
  currency?: number;
  usd?: number;
  finPerson?: string;
  driver?: string;
  carId?: number;
  senderPersonId?: number;
  deadlineDate?: bigint;
  exitCompleted?: boolean;
  incomeCompleted?: boolean;
  initialPayment?: number;
  contractNumber?: string;
  materialResponsiblePersonId?: number;
  invoiceImagePath?: string;
  invoiceImagePath2?: string;
  invoiceImagePath3?: string;
  sourceOrderWorkId?: number;
  sourceOrderWorkLogId?: number;
  orderId?: number;
  workId?: number;
  clientContractId?: number | null;
  clientContractLineId?: number | null;
  remainCount?: number;
  settlementDate?: bigint;
  mediatorId?: number;
  partnerId?: number;
  delivererId?: number;
  deliverySum?: number;
  defectCost?: number;
  returnDateTime?: bigint;
  cashReceived?: number;
  plasticReceived?: number;
  changeToClient?: number;
  debtSum?: number;
  debtComment?: string;
  rentTariffType?: string;
  sourceRentalOrderDocId?: number | null;
  fulfilledByTransferDocId?: number | null;
  advancePhase?: string | null;
  formworkLayout?: Record<string, unknown> | null;
}

@Table({ tableName: "docvalues" })
export class DocValues extends Model<DocValues, DocValuesCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.BIGINT,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: bigint;

  @ForeignKey(() => Document)
  @ApiProperty({ example: "12222897", description: "Идентификатор документа" })
  @Column({ type: DataType.BIGINT })
  docId: bigint;

  @BelongsTo(() => Document)
  document: Document;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222897", description: "Id - отправителя" })
  @Column({ type: DataType.INTEGER })
  senderId: number;

  @BelongsTo(() => Reference)
  senderReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222897", description: "Id - получателя" })
  @Column({ type: DataType.INTEGER })
  receiverId: number;

  @BelongsTo(() => Reference)
  receiverReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - аналитики",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  analiticId?: number;

  @BelongsTo(() => Reference)
  analiticReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: "12222897",
    description: "Id - продукта для учета расходов",
  })
  @Column({ type: DataType.INTEGER })
  productForChargeId?: number;

  @BelongsTo(() => Reference)
  productForChargeReference: Reference;

  @ApiProperty({ example: "true", description: "isWorker?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isWorker?: boolean;

  @ApiProperty({ example: "true", description: "isPartner?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isPartner?: boolean;

  @ApiProperty({ example: "true", description: "isClient?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isClient?: boolean;

  @ApiProperty({ example: "true", description: "isDepartment?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isDepartment?: boolean;

  @ApiProperty({ example: "true", description: "isFounder?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isFounder?: boolean;

  @ApiProperty({ example: "true", description: "isMediator?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isMediator?: boolean;

  @ApiProperty({ example: "true", description: "isDeliverer?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isDeliverer?: boolean;

  @ApiProperty({ example: "10", description: "Количество" })
  @Column({ type: DataType.FLOAT })
  count?: number;

  @ApiProperty({ example: "15000", description: "Цена" })
  @Column({ type: DataType.FLOAT })
  price?: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @Column({ type: DataType.FLOAT })
  total?: number;

  @ApiProperty({
    example: "150000",
    description: "Полученные деньги с партнера",
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  cashFromPartner?: number;

  @ApiProperty({ example: "....", description: "Комментарий к документу" })
  @Column({ type: DataType.STRING })
  comment?: string;

  @ApiProperty({ example: "150000", description: "Валюта х.р" })
  @Column({ type: DataType.FLOAT, allowNull: true })
  currency?: number;

  @ApiProperty({ example: "150000", description: "Валюта х.р всего" })
  @Column({ type: DataType.FLOAT, allowNull: true })
  usd?: number;

  @ApiProperty({ example: "....", description: "Комментарий к документу" })
  @Column({ type: DataType.STRING })
  finPerson?: string;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "1", description: "ID автомобиля" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  carId?: number;

  @BelongsTo(() => Reference)
  carReference: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "1", description: "ID сотрудника отправителя" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  senderPersonId?: number;

  @BelongsTo(() => Reference)
  senderPersonReference: Reference;

  @ApiProperty({ example: "Иванов И.И.", description: "Водитель" })
  @Column({ type: DataType.STRING, allowNull: true })
  driver?: string;

  @ApiProperty({
    example: "1640995200000",
    description: "Срок выполнения заказа",
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  deadlineDate?: bigint;

  @ApiProperty({
    example: false,
    description: "Флаг завершения выезда машины по накладной",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  exitCompleted?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг использования накладной для входа (единоразовый документ)",
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  incomeCompleted?: boolean;

  // Поля для продажи квартир
  @ApiProperty({
    example: 10000,
    description: "Авансовый платеж",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(15, 2), allowNull: true })
  initialPayment?: number;

  @ApiProperty({
    example: "ДГ-2024-001",
    description: "Номер договора",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  contractNumber?: string;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 1,
    description: "ID материально ответственного лица",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  materialResponsiblePersonId?: number;

  @BelongsTo(() => Reference, "materialResponsiblePersonId")
  materialResponsiblePerson?: Reference;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-123456789.jpg",
    description: "Путь к изображению-основанию (ComeMaterial, ComeTovar, LeaveCash, ComeCashFromClients)",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  invoiceImagePath?: string;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-223456789.jpg",
    description: "Путь ко второму изображению накладной",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  invoiceImagePath2?: string;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-323456789.jpg",
    description: "Путь к третьему изображению накладной",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  invoiceImagePath3?: string;

  @ApiProperty({
    example: 1501,
    description: "ID работы заказа-источника (для списаний из журнала работ)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceOrderWorkId?: number;

  @ApiProperty({
    example: 9801,
    description: "ID лога работы-источника (опционально)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceOrderWorkLogId?: number;

  @ApiProperty({
    example: 1001,
    description: "ID заказа (orderId)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  orderId?: number;

  @ApiProperty({
    example: 1501,
    description: "ID работы заказа (workId)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  workId?: number;

  @ApiProperty({
    example: 120.5,
    description: "Остаток материала на складе на момент выбора",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  remainCount?: number;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 1,
    description: "ID посредника (MEDIATORS)",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  mediatorId?: number;

  @BelongsTo(() => Reference, "mediatorId")
  mediatorReference?: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 1,
    description: "ID партнёра субаренды (PARTNERS / SUPPLIERS)",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  partnerId?: number;

  @BelongsTo(() => Reference, "partnerId")
  partnerReference?: Reference;

  @ForeignKey(() => Reference)
  @ApiProperty({
    example: 1,
    description: "ID доставщика (DELIVERERS)",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  delivererId?: number;

  @BelongsTo(() => Reference, "delivererId")
  delivererReference?: Reference;

  @ApiProperty({
    example: 50000,
    description: "Сумма доставки",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  deliverySum?: number;

  @ApiProperty({
    example: 25000,
    description: "Брак буйича харажатлар",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  defectCost?: number;

  @ApiProperty({
    example: "1640995200000",
    description: "Расчётная дата-время аренды",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  settlementDate?: bigint;

  @ApiProperty({
    example: "1640995200000",
    description: "Дата-время возврата инструментов",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  returnDateTime?: bigint;

  @ApiProperty({
    example: 50000,
    description: "Получено наличными при возврате",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(15, 2), allowNull: true })
  cashReceived?: number;

  @ApiProperty({
    example: 30000,
    description: "Получено пластиком при возврате",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(15, 2), allowNull: true })
  plasticReceived?: number;

  @ApiProperty({
    example: 10000,
    description: "Сдачи клиенту наличными из кассы",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(15, 2), allowNull: true })
  changeToClient?: number;

  @ApiProperty({
    example: 20000,
    description: "Сумма в долг при возврате",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(15, 2), allowNull: true })
  debtSum?: number;

  @ApiProperty({
    example: "Оплата в следующем месяце",
    description: "Комментарий к долгу",
    required: false,
  })
  @Column({ type: DataType.STRING, allowNull: true })
  debtComment?: string;

  @ApiProperty({
    example: "CASH",
    description:
      "Тип тарифа аренды: CASH (firstPrice) или TRANSFER (thirdPrice)",
    required: false,
  })
  @Column({ type: DataType.STRING(16), allowNull: true })
  rentTariffType?: string;

  @ApiProperty({
    example: 101,
    description: "ID буюртмы (OrderToolsToClient), из которой создан Топшириш",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  sourceRentalOrderDocId?: number | null;

  @ApiProperty({
    example: 202,
    description: "ID Топшириш, которым закрыта буюртма",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  fulfilledByTransferDocId?: number | null;

  @ApiProperty({
    example: "ISSUED",
    description: "Фаза аванса: DRAFT, ISSUED, CLOSED",
    required: false,
  })
  @Column({ type: DataType.STRING(16), allowNull: true })
  advancePhase?: string | null;

  @ApiProperty({
    example: 12,
    description: "ID договора с клиентом (client_contracts)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  clientContractId?: number | null;

  @ApiProperty({
    example: 34,
    description: "ID строки договора (заказ или ТМЦ/услуга)",
    required: false,
  })
  @Column({ type: DataType.BIGINT, allowNull: true })
  clientContractLineId?: number | null;

  @ApiProperty({
    description:
      "Чертёж фундамента и результат расчёта опалубки (JSON, см. FormworkLayout на фронтенде)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  formworkLayout?: Record<string, unknown> | null;
}
