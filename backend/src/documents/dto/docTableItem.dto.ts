import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsEnum,
  ValidateIf,
} from "class-validator";

export class DocTableItemDto {
  @ApiProperty({
    example: "12222897",
    description: "Идентификатор документа",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "docId - должен быть натуральным числом" })
  docId?: bigint;

  @ApiProperty({
    example: "1",
    description: "Уникальный идентификатор элемента таблицы",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "id - должен быть натуральным числом" })
  id?: bigint;

  @ApiProperty({ example: "12222897", description: "Id - аналитики" })
  @IsInt({ message: "analiticId - должен быть натуральным числом" })
  analiticId: number;

  @ApiProperty({ example: "150000", description: "Остаток" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "balance - должен быть числом" })
  balance: number;

  @ApiProperty({ example: "10", description: "Количество" })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "count - должен быть числом" })
  count: number;

  @ApiProperty({ example: "15000", description: "Цена" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "price - должен быть числом" })
  price: number;

  @ApiProperty({ example: "150000", description: "Всего" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "total - должен быть числом" })
  total: number;

  @ApiProperty({
    example: "12000",
    description: "Себестоимость единицы товара",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "costPrice - должен быть числом" })
  costPrice: number;

  @ApiProperty({ example: "120000", description: "Общая себестоимость" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "costTotal - должен быть числом" })
  costTotal: number;

  @ApiProperty({
    example: "10",
    description: "Количество в коробках",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "countByBox - должен быть числом" })
  countByBox?: number;

  @ApiProperty({
    example: "10",
    description: "Количество в коробках для расчета",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "refCountInBox - должен быть числом" })
  refCountInBox?: number;

  @ApiProperty({
    example: "income",
    description: "Тип таблицы: income - приход, expense - списание материалов",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsOptional()
  @IsEnum(["income", "expense", "return", "brak", "sale", "tovar"], {
    message:
      "tableType должен быть income, expense, return, brak, sale или tovar",
  })
  tableType?: "income" | "expense" | "return" | "brak" | "sale" | "tovar";

  @ApiProperty({
    example: 12.5,
    description: "Плановое количество из заказа (LeaveMaterial fill)",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "plannedCount - должен быть числом" })
  plannedCount?: number;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата создания элемента таблицы",
    required: false,
  })
  @IsOptional()
  createdAt?: string | number | null;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата обновления элемента таблицы",
    required: false,
  })
  @IsOptional()
  updatedAt?: string | number | null;

  @ApiProperty({
    example: "Комментарий",
    description:
      "Комментарий к элементу таблицы (не используется в модели, игнорируется)",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "comment - должен быть строкой" })
  comment?: string;

  @ApiProperty({
    example: 5000,
    description: "Часовой тариф аренды",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "hourlyTariff - должен быть числом" })
  hourlyTariff?: number;

  @ApiProperty({
    example: 120000,
    description: "Сумма аренды за сутки",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "dailyRent - должен быть числом" })
  dailyRent?: number;

  @ApiProperty({
    example: 1001,
    description: "ID документа передачи (партия FIFO)",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "sourceTransferDocId - должен быть целым числом" })
  sourceTransferDocId?: number;

  @ApiProperty({
    example: 15000,
    description: "Сумма аренды по строке",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "rentSum - должен быть числом" })
  rentSum?: number;

  @ApiProperty({
    example: 4000,
    description: "Часовой тариф партнёра (субаренда)",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "partnerHourlyTariff - должен быть числом" })
  partnerHourlyTariff?: number;

  @ApiProperty({
    example: 12000,
    description: "Сумма аренды партнёра по строке",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "partnerRentSum - должен быть числом" })
  partnerRentSum?: number;

  @ApiProperty({
    example: 48,
    description: "Часы аренды по строке",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "rentHours - должен быть числом" })
  rentHours?: number;

  @ApiProperty({
    example: 1700000000000,
    description: "Дата начала аренды (из документа передачи)",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "settlementDate - должен быть числом" })
  settlementDate?: number;

  @ApiProperty({
    example: "expense",
    description: "Тип строки аванса",
    required: false,
  })
  @IsOptional()
  @IsString()
  lineKind?: string | null;

  @ApiProperty({
    example: 10,
    description: "Отдел или кошелёк учредителя строки аванса",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? null : value,
  )
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsInt({ message: "lineStorageId - должен быть целым числом" })
  lineStorageId?: number | null;
}
