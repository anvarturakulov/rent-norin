import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  Length,
  IsEnum,
  IsNumber,
  ValidateIf,
  IsOptional,
  IsBoolean,
  IsArray,
} from "class-validator";
import { UserRoles } from "src/interfaces/user.interface";
import { isGlobalRole } from "src/utils/roleHelpers";

export class CreateUserDto {
  @ApiProperty({ example: "user@mail.ru", description: "Почтовый адрес" })
  @IsString({ message: "email - должно быть строкой" })
  @IsEmail({}, { message: "Не корректный email" })
  readonly email: string;

  @ApiProperty({ example: "12345678", description: "Пароль" })
  @IsString({ message: "password - должно быть строкой" })
  @Length(4, 50, { message: "password - не меньше 4 и не больше 16" })
  readonly password: string;

  @ApiProperty({ example: "Анвар", description: "Имя" })
  @IsString({ message: "name - должно быть строкой" })
  @Length(4, 50, { message: "name - не меньше 4 и не больше 16" })
  readonly name: string;

  @ApiProperty({ example: "USER ROLE", description: "Роль" })
  @IsString({ message: "role - должен быть строкой" })
  @IsEnum(UserRoles, { message: "role - должен быть из списка ролей" })
  readonly role: UserRoles;

  @ApiProperty({
    example: "false",
    description: "Забанен или нет",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "banned - должен быть boolean" })
  readonly banned?: boolean;

  @ApiProperty({
    example: "???",
    description: "Причина блокировки или разблокировки пользователя",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "banReason - должно быть строкой" })
  readonly banReason?: string;

  @ApiProperty({
    example: "12222897",
    description: "Id - подразделения",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "sectionId - должен быть натуральным числом" })
  readonly sectionId?: number;

  @ApiProperty({
    example: "11111111111",
    description: "Телеграм Id",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "telegramId - должно быть строкой" })
  readonly telegramId?: string;

  @ApiProperty({
    example: 1,
    description: "Идентификатор предприятия",
    required: false,
  })
  @ValidateIf(
    (o) =>
      o.enterpriseId != null &&
      o.enterpriseId !== undefined &&
      !isGlobalRole(o.role),
  )
  @IsNumber({}, { message: "enterpriseId - должно быть числом" })
  readonly enterpriseId?: number | null;

  @ApiProperty({
    example: "[1,2,3]",
    description:
      "Массив идентификаторов storages для принятия межпредприятийных документов",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "allowedStorageIds - должен быть массивом" })
  @IsNumber(
    {},
    {
      each: true,
      message: "Каждый элемент allowedStorageIds должен быть числом",
    },
  )
  readonly allowedStorageIds?: number[] | null;

  @ApiProperty({
    example: false,
    description:
      "Суперкасса - позволяет вводить справочники (партнеры, сотрудники) от имени других организаций",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "superKassir - должен быть boolean" })
  readonly superKassir?: boolean;

  @ApiProperty({
    example: { TMZ: { canView: true, canCreate: true } },
    description: "Права доступа по справочникам",
    required: false,
  })
  @IsOptional()
  readonly referencePermissions?: Record<string, unknown> | null;
}
