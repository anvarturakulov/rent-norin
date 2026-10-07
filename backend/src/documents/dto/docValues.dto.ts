import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  Min,
  ValidateIf,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { Logger } from "@nestjs/common";
import type { RentTariffType } from "src/interfaces/document.interface";

/**
 * undefined → поле не передано (колонку не трогаем);
 * null / "" / 0 → null (явная очистка);
 * иначе → number.
 */
const transformOptionalPaymentNumber = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "" || value === 0 || value === "0") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed === 0 ? null : parsed;
};

const transformOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === 0 || value === "0") {
    return null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : value;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
  }
  return value;
};

export class DocValuesDto {
  @ApiProperty({
    example: "1",
    description: "Идентификатор docValues",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "id - должен быть натуральным числом" })
  id?: number;

  @ApiProperty({
    example: "12222897",
    description: "Идентификатор документа",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "docId - должен быть натуральным числом" })
  docId?: bigint;

  @ApiProperty({ example: "12222897", description: "Id - отправителя" })
  @IsNumber({}, { message: "senderId - должен быть натуральным числом" })
  senderId: number;

  @ApiProperty({ example: "12222897", description: "Id - получателя" })
  @IsInt({ message: "receiverId - должен быть натуральным числом" })
  receiverId: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - аналитики",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "analiticId - должен быть натуральным числом" })
  analiticId?: number;

  @ApiProperty({
    example: "12222897",
    description: "Id - productForChargeId",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "productForChargeId - должен быть натуральным числом" })
  productForChargeId?: number;

  @ApiProperty({ example: "true", description: "isWorker?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isWorker Значание должно быть TRUE или FALSE" })
  isWorker?: boolean;

  @ApiProperty({ example: "true", description: "isPartner?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isPartner Значание должно быть TRUE или FALSE" })
  isPartner?: boolean;

  @ApiProperty({ example: "true", description: "isClient?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isClient Значание должно быть TRUE или FALSE" })
  isClient?: boolean;

  @ApiProperty({
    example: "true",
    description: "isDepartment?",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isDepartment Значание должно быть TRUE или FALSE" })
  isDepartment?: boolean;

  @ApiProperty({ example: "true", description: "isFounder?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isFounder Значание должно быть TRUE или FALSE" })
  isFounder?: boolean;

  @ApiProperty({ example: "true", description: "isMediator?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isMediator Значание должно быть TRUE или FALSE" })
  isMediator?: boolean;

  @ApiProperty({ example: "true", description: "isDeliverer?", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isDeliverer Значание должно быть TRUE или FALSE" })
  isDeliverer?: boolean;

  @ApiProperty({ example: "10", description: "Количество", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "count - должно быть номером" })
  count?: number;

  @ApiProperty({ example: "15000", description: "Цена", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "price - должно быть номером" })
  price?: number;

  @ApiProperty({ example: "150000", description: "Всего", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "total - должно быть номером" })
  total?: number;

  @ApiProperty({
    example: "150000",
    description: "Полученные деньги с партнера",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "cashFromPartner - должно быть номером" })
  cashFromPartner?: number | null;

  @ApiProperty({
    example: "....",
    description: "Комментарий к документу",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "comment - должен быть строкой" })
  comment?: string;

  @ApiProperty({
    example: "150000",
    description: "Валюта х.р",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "currency - должно быть номером" })
  currency?: number | null;

  @ApiProperty({
    example: "150000",
    description: "Валюта х.р всего",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "usd - должно быть номером" })
  usd?: number | null;

  @ApiProperty({
    example: "....",
    description: "Материально ответственное лицо",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "finPerson - должен быть строкой" })
  finPerson?: string;

  @ApiProperty({ example: "1", description: "ID автомобиля", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "carId - должен быть натуральным числом" })
  carId?: number;

  @ApiProperty({
    example: "1",
    description: "ID сотрудника отправителя",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "senderPersonId - должен быть натуральным числом" })
  senderPersonId?: number;

  @ApiProperty({
    example: "Иванов И.И.",
    description: "Водитель",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "driver - должен быть строкой" })
  driver?: string;

  @ApiProperty({
    example: 1738368000000,
    description: "Дата дедлайна",
    required: false,
  })
  @IsOptional()
  deadlineDate?: number | string | null;

  @ApiProperty({
    example: false,
    description: "Признак выполнения",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "exitCompleted Значание должно быть TRUE или FALSE" })
  exitCompleted?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг использования накладной для входа (единоразовый документ)",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "incomeCompleted Значание должно быть TRUE или FALSE" })
  incomeCompleted?: boolean;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата создания docValues",
    required: false,
  })
  @IsOptional()
  createdAt?: string | number | null;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата обновления docValues",
    required: false,
  })
  @IsOptional()
  updatedAt?: string | number | null;

  // Поля для продажи квартир
  @ApiProperty({
    example: 10000,
    description: "Авансовый платеж",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "initialPayment - должно быть номером" })
  initialPayment?: number | null;

  @ApiProperty({
    example: "ДГ-2024-001",
    description: "Номер договора",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "contractNumber - должен быть строкой" })
  contractNumber?: string;

  @ApiProperty({
    example: 1,
    description: "ID материально ответственного лица",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({
    message: "materialResponsiblePersonId - должен быть натуральным числом",
  })
  materialResponsiblePersonId?: number;

  // Вычисляемое поле себестоимости (не сохраняется в БД, только для отображения в журнале)
  @ApiProperty({
    example: 150000,
    description: "Вычисленная себестоимость",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "calculatedCostTotal - должно быть номером" })
  calculatedCostTotal?: number;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-123456789.jpg",
    description: "Путь к изображению-основанию (ComeMaterial, ComeTovar, LeaveCash, ComeCashFromClients)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "invoiceImagePath - должен быть строкой" })
  invoiceImagePath?: string;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-223456789.jpg",
    description: "Путь ко второму изображению накладной",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "invoiceImagePath2 - должен быть строкой" })
  invoiceImagePath2?: string;

  @ApiProperty({
    example: "/uploads/docs/doc-1738368000000-323456789.jpg",
    description: "Путь к третьему изображению накладной",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "invoiceImagePath3 - должен быть строкой" })
  invoiceImagePath3?: string;

  @ApiProperty({
    example: 1501,
    description: "ID работы заказа-источника (для списаний из журнала работ)",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "sourceOrderWorkId - должен быть натуральным числом" })
  sourceOrderWorkId?: number;

  @ApiProperty({
    example: 9801,
    description: "ID лога работы-источника",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "sourceOrderWorkLogId - должен быть натуральным числом" })
  sourceOrderWorkLogId?: number;

  @ApiProperty({
    example: 1001,
    description: "ID заказа (orderId)",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "orderId - должен быть натуральным числом" })
  orderId?: number;

  @ApiProperty({
    example: 1501,
    description: "ID работы заказа (workId)",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "workId - должен быть натуральным числом" })
  workId?: number;

  @ApiProperty({
    example: 120.5,
    description: "Остаток материала на складе на момент выбора",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "remainCount - должно быть номером" })
  remainCount?: number;

  @ApiProperty({
    example: "1640995200000",
    description: "Расчётная дата-время аренды",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "settlementDate - должно быть номером" })
  settlementDate?: number;

  @ApiProperty({
    example: 1,
    description: "ID посредника",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "mediatorId - должен быть целым числом" })
  mediatorId?: number;

  @ApiProperty({
    example: 1,
    description: "ID партнёра субаренды",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "partnerId - должен быть целым числом" })
  partnerId?: number;

  @ApiProperty({
    example: 1,
    description: "ID доставщика",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "delivererId - должен быть целым числом" })
  delivererId?: number;

  @ApiProperty({
    example: 50000,
    description: "Сумма доставки",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "deliverySum - должно быть номером" })
  deliverySum?: number | null;

  @ApiProperty({
    example: 25000,
    description: "Брак буйича харажатлар",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "defectCost - должно быть номером" })
  defectCost?: number | null;

  @ApiProperty({
    example: "1640995200000",
    description: "Дата-время возврата",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "returnDateTime - должно быть номером" })
  returnDateTime?: number;

  @ApiProperty({
    example: 50000,
    description: "Получено наличными",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "cashReceived - должно быть номером" })
  cashReceived?: number | null;

  @ApiProperty({
    example: 30000,
    description: "Получено пластиком",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "plasticReceived - должно быть номером" })
  plasticReceived?: number | null;

  @ApiProperty({
    example: 10000,
    description: "Сдачи клиенту наличными из кассы",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "changeToClient - должно быть номером" })
  changeToClient?: number | null;

  @ApiProperty({
    example: 20000,
    description: "Сумма в долг",
    required: false,
  })
  @Transform(transformOptionalPaymentNumber)
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "debtSum - должно быть номером" })
  debtSum?: number | null;

  @ApiProperty({
    example: "Оплата в следующем месяце",
    description: "Комментарий к долгу",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "debtComment - должно быть строкой" })
  debtComment?: string;

  @ApiProperty({
    example: "CASH",
    description:
      "Тип тарифа аренды: CASH (firstPrice) или TRANSFER (thirdPrice)",
    required: false,
    enum: ["CASH", "TRANSFER"],
  })
  @Transform(({ value }) =>
    value === "" || value == null ? undefined : value,
  )
  @IsOptional()
  @IsIn(["CASH", "TRANSFER"], { message: "rentTariffType - CASH или TRANSFER" })
  rentTariffType?: RentTariffType;

  @ApiProperty({
    example: 12,
    description: "ID договора с клиентом",
    required: false,
  })
  @Transform(transformOptionalInt)
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsInt({ message: "clientContractId - должен быть целым числом" })
  clientContractId?: number | null;

  @ApiProperty({
    example: 34,
    description: "ID строки договора",
    required: false,
  })
  @Transform(transformOptionalInt)
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsInt({ message: "clientContractLineId - должен быть целым числом" })
  clientContractLineId?: number | null;

  @ApiProperty({
    example: 101,
    description: "ID буюртмы, из которой создан Топшириш",
    required: false,
  })
  @Transform(transformOptionalInt)
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsInt({ message: "sourceRentalOrderDocId - должен быть целым числом" })
  sourceRentalOrderDocId?: number | null;

  @ApiProperty({
    example: 202,
    description: "ID Топшириш, которым закрыта буюртма",
    required: false,
  })
  @Transform(transformOptionalInt)
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsInt({ message: "fulfilledByTransferDocId - должен быть целым числом" })
  fulfilledByTransferDocId?: number | null;

  @ApiProperty({
    example: "ISSUED",
    description: "Фаза аванса: DRAFT, ISSUED, CLOSED",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(["DRAFT", "ISSUED", "CLOSED"])
  advancePhase?: string | null;

  @ApiProperty({
    description: "Чертёж фундамента и результат расчёта опалубки (JSON)",
    required: false,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject({ message: "formworkLayout - должен быть объектом" })
  formworkLayout?: Record<string, unknown> | null;
}
