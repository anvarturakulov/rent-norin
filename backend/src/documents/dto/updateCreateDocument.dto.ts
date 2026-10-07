import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsEnum,
  IsDate,
  IsInt,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { DocSTATUS, DocumentType } from "src/interfaces/document.interface";
import { DocTableItemDto } from "./docTableItem.dto";
import { DocValuesDto } from "./docValues.dto";

export class UpdateCreateDocumentDto {
  @ApiProperty({
    example: "1738368000000",
    description: "Дата документа в миллисекундах",
  })
  @Transform(({ value }) => {
    // Преобразуем bigint/string в number для валидации
    // Sequelize возвращает bigint как строку при JSON сериализации
    if (typeof value === "string") {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    return value;
  })
  @IsInt({ message: "date - должен быть натуральным числом" })
  date: bigint;

  @ApiProperty({ example: "12222", description: "Идентификатор пользователя" })
  @IsInt({ message: "userId - должен быть натуральным числом" })
  userId: number;

  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "enterpriseId - должен быть натуральным числом" })
  enterpriseId?: number;

  @ApiProperty({
    required: false,
    description: "Объект предприятия; приходит при получении документа",
  })
  @IsOptional()
  enterprise?: any;

  @ApiProperty({ example: "12222", description: "Идентификатор пользователя" })
  // @IsString({message: 'userOldId - должен быть строкой'})
  userOldId: string;

  @ApiProperty({
    example: false,
    required: false,
    description: "Флаг межпредприятийного документа; вычисляется на бэкенде",
  })
  @IsOptional()
  isInterEnterprise?: boolean;

  @ApiProperty({
    example: false,
    required: false,
    description: "Флаг блокировки документа; задается только бэкендом",
  })
  @IsOptional()
  isLocked?: boolean;

  @ApiProperty({
    example: "Неверные данные",
    required: false,
    description: "Причина отклонения; задается на бэкенде",
  })
  @IsOptional()
  @IsString({ message: "rejectionReason - должен быть строкой" })
  rejectionReason?: string | null;

  @ApiProperty({
    example: 1738368000000,
    required: false,
    description:
      "Дата создания документа (timestamp); устанавливается на бэкенде",
  })
  @IsOptional()
  createdAt?: number;

  @ApiProperty({
    example: 1738368000000,
    required: false,
    description:
      "Дата обновления документа (timestamp); устанавливается на бэкенде",
  })
  @IsOptional()
  updatedAt?: number;

  @ApiProperty({
    example: "1",
    description: "Идентификатор предприятия-отправителя",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "sourceEnterpriseId - должен быть натуральным числом" })
  sourceEnterpriseId?: number | null;

  @ApiProperty({
    required: false,
    description: "Объект предприятия-отправителя",
  })
  @IsOptional()
  sourceEnterprise?: any;

  @ApiProperty({
    example: "2",
    description: "Идентификатор предприятия-получателя",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "targetEnterpriseId - должен быть натуральным числом" })
  targetEnterpriseId?: number | null;

  @ApiProperty({
    required: false,
    description: "Объект предприятия-получателя",
  })
  @IsOptional()
  targetEnterprise?: any;

  @ApiProperty({
    example: "MoveCash",
    description: "Тип документа для отправителя",
    required: false,
  })
  @IsOptional()
  @IsEnum(DocumentType, {
    message: "documentTypeForSender - должен быть из списка типов документа",
  })
  documentTypeForSender?: DocumentType | null;

  @ApiProperty({
    example: "ComeCashFromDepartments",
    description: "Тип документа для получателя",
    required: false,
  })
  @IsOptional()
  @IsEnum(DocumentType, {
    message: "documentTypeForReceiver - должен быть из списка типов документа",
  })
  documentTypeForReceiver?: DocumentType | null;

  @ApiProperty({
    example: "ComeMaterial",
    description: "Тип документа - из списка документов",
  })
  @IsEnum(DocumentType, {
    message: "DocumentType - должен быть из списка типов документа",
  })
  documentType: DocumentType;

  @ApiProperty({
    example: "OPEN",
    description: "Статус документа - ( OPEN || DELETED || PROVEDEN )",
  })
  @IsEnum(DocSTATUS, {
    message: "DocSTATUS - должен быть из списка типов статуса документа",
  })
  docStatus: DocSTATUS;

  @ApiProperty({
    example: false,
    required: false,
    description: "Флаг предварительного сохранения (без автопроводки)",
  })
  @IsOptional()
  @IsBoolean()
  saveOnly?: boolean;

  @ApiProperty({ type: DocValuesDto, description: "Значения документа" })
  @ValidateNested()
  @Type(() => DocValuesDto)
  docValues: DocValuesDto;

  @ApiProperty({
    type: [DocTableItemDto],
    description: "Элементы таблицы документа",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocTableItemDto)
  docTableItems: DocTableItemDto[];
}
