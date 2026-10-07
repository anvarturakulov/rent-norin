import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsString,
  Length,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateIf,
  IsArray,
  IsObject,
  IsDateString,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";
import {
  TypePartners,
  TypeSECTION,
  TypeTMZ,
  CarType,
  ProductionType,
  PriceClass,
  TypeMediator,
  FormworkKind,
} from "src/interfaces/reference.interface";

export class CreateReferenceValueDto {
  @ApiProperty({
    example: "1",
    description: "Идентификатор refValues",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: "id - должен быть натуральным числом" })
  id?: number;

  @ApiProperty({
    example: "12222",
    description: "Идентификатор справочника",
    required: false,
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "referenceId - должен быть натуральным числом" })
  referenceId?: number;

  @ApiProperty({
    example: "12222",
    description: "Кому относится клиент - идентификатор подразделения",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "clientForSectionId - должен быть натуральным числом" })
  clientForSectionId?: number;

  @ApiProperty({
    example: 1,
    description: "Партнёр для склада субаренды (PARTNER_TOOLS)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "partnerId - должен быть натуральным числом" })
  partnerId?: number;

  @ApiProperty({
    example: "CLIENTS",
    description: "Тип партнера - ( CLIENTS || SUPPLIERS )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(TypePartners, {
    message: "typePartners - должен быть из списка типов партнеров",
  })
  typePartners?: TypePartners;

  @ApiProperty({
    example: 1,
    description: "ID посредника, привлёкшего клиента",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "referredByMediatorId - должен быть целым числом" })
  referredByMediatorId?: number;

  @ApiProperty({ example: false, description: "Воситачи — водитель", required: false })
  @IsOptional()
  @IsBoolean()
  isMediatorDriver?: boolean;

  @ApiProperty({ example: false, description: "Воситачи — мастер", required: false })
  @IsOptional()
  @IsBoolean()
  isMediatorMaster?: boolean;

  @ApiProperty({ example: false, description: "Физическое лицо", required: false })
  @IsOptional()
  @IsBoolean()
  isIndividualPerson?: boolean;

  @ApiProperty({ example: "AA", description: "Серия паспорта", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim().toUpperCase(),
  )
  @IsOptional()
  @ValidateIf(
    (o, v) =>
      o.isIndividualPerson === true &&
      v !== undefined &&
      v !== null &&
      v !== "",
  )
  @Matches(/^[A-Z]{2}$/, {
    message: "passportSeries — 2 латинские буквы",
  })
  passportSeries?: string;

  @ApiProperty({ example: "1234567", description: "Номер паспорта", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim(),
  )
  @IsOptional()
  @ValidateIf(
    (o, v) =>
      o.isIndividualPerson === true &&
      v !== undefined &&
      v !== null &&
      v !== "",
  )
  @Matches(/^\d{7}$/, {
    message: "passportNumber — 7 цифр",
  })
  passportNumber?: string;

  @ApiProperty({
    example: "2015-06-01",
    description: "Дата выдачи паспорта",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf(
    (o, v) =>
      o.isIndividualPerson === true &&
      v !== undefined &&
      v !== null &&
      v !== "",
  )
  @IsDateString({}, { message: "passportIssueDate — дата" })
  passportIssueDate?: string;

  @ApiProperty({
    example: "ИИБ Мирабадского р-на",
    description: "Кем выдан паспорт",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim(),
  )
  @IsOptional()
  @ValidateIf(
    (o, v) =>
      o.isIndividualPerson === true &&
      v !== undefined &&
      v !== null &&
      v !== "",
  )
  @MinLength(3, { message: "passportIssuedBy — минимум 3 символа" })
  @MaxLength(500, { message: "passportIssuedBy — максимум 500 символов" })
  passportIssuedBy?: string;

  @ApiProperty({ example: false, description: "Юридическое лицо", required: false })
  @IsOptional()
  @IsBoolean()
  isLegalEntity?: boolean;

  @ApiProperty({ example: "Асака банк", description: "Наименование банка", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim(),
  )
  @ValidateIf((o) => o.isLegalEntity === true)
  @MinLength(2, { message: "bankName — минимум 2 символа" })
  @MaxLength(255, { message: "bankName — максимум 255 символов" })
  bankName?: string;

  @ApiProperty({
    example: "20208000123456789012",
    description: "Расчётный счёт",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim(),
  )
  @ValidateIf((o) => o.isLegalEntity === true)
  @Matches(/^\d{20}$/, {
    message: "bankAccount — 20 цифр",
  })
  bankAccount?: string;

  @ApiProperty({ example: "00401", description: "МФО банка", required: false })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : String(value).trim(),
  )
  @ValidateIf((o) => o.isLegalEntity === true)
  @Matches(/^\d{5}$/, {
    message: "bankMfo — 5 цифр",
  })
  bankMfo?: string;

  @ApiProperty({
    example: "DRIVER",
    description: "Тип посредника - ( DRIVER || MASTER )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(TypeMediator, {
    message: "mediatorType - должен быть из списка типов посредников",
  })
  mediatorType?: TypeMediator;

  @ApiProperty({
    example: "MATERIAL",
    description:
      "Тип ТМЗ - ( MATERIAL || PRODUCT || HALFSTUFF || OS || TOOLS || TOVAR )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(TypeTMZ, { message: "typeTMZ - должен быть из списка типов ТМЗ" })
  typeTMZ?: TypeTMZ;

  @ApiProperty({
    example: "DELIVERY",
    description:
      "Тип подразделения - ( DELIVERY || FILIAL || COMMON || STORAGE || ACCOUNTANT || DIRECTOR || FOUNDER || PRODUCTION )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(TypeSECTION, {
    message: "typeSection - должен быть из списка типов подразделения",
  })
  typeSection?: TypeSECTION;

  @ApiProperty({ example: "кг", description: "Единица измерения" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "unit - должен быть строкой" })
  unit?: string;

  @ApiProperty({ example: "....", description: "Единица измерения" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "comment - должен быть строкой" })
  comment?: string;

  @ApiProperty({ example: "false", description: "Помечан на удаление?" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "markToDeleted - значание должно быть TRUE или FALSE" })
  markToDeleted?: boolean;

  @ApiProperty({
    example: false,
    description: "Импортирован из Excel",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "importedFromXlsx - значение должно быть TRUE или FALSE" })
  importedFromXlsx?: boolean;

  @ApiProperty({
    example: "1.35",
    description: "Норма затрат на ед. материала?",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "norma - должен быть числом" })
  norma?: number;

  @ApiProperty({ example: "true", description: "Мука?" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "un - значание должно быть TRUE или FALSE" })
  un?: boolean;

  @ApiProperty({ example: "true", description: "Долгосрочный тип затрат?" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "longCharge - значание должно быть TRUE или FALSE" })
  longCharge?: boolean;

  @ApiProperty({ example: "true", description: "Личные затраты Шавката?" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "shavkatCharge - значание должно быть TRUE или FALSE" })
  shavkatCharge?: boolean;

  @ApiProperty({ example: "3400", description: "Первая цена" })
  @Transform(({ value }) => {
    // Пустые значения → undefined
    if (value === null || value === "" || value === 0) return undefined;

    // Если уже число - возвращаем как есть
    if (typeof value === "number") return value;

    // Если строка - пытаемся преобразовать
    if (typeof value === "string") {
      const numValue = parseFloat(value);
      // Если валидное число - возвращаем число, иначе оставляем строку для валидации
      return isNaN(numValue) ? value : numValue;
    }

    return value;
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "firstPrice - должен быть числом" })
  firstPrice?: number;

  @ApiProperty({ example: "3800", description: "Вторая цена" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "secondPrice - должен быть числом" })
  secondPrice?: number;

  @ApiProperty({ example: "4000", description: "Третья цена" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "thirdPrice - должен быть числом" })
  thirdPrice?: number;

  @ApiProperty({ example: "12", description: "Количество в коробке" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsInt({ message: "countInBox - должен быть натуральным числом" })
  countInBox?: number;

  @ApiProperty({ example: "....", description: "Id телеграм" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "telegramId - должен быть строкой" })
  telegramId?: string;

  @ApiProperty({ example: "....", description: "Номер телефона" })
  @Transform(({ value }) => {
    // Преобразуем null/undefined в undefined, остальное оставляем как есть
    if (value === null || value === undefined) return undefined;
    // Преобразуем в строку для безопасности (защита от объектов/массивов)
    return String(value);
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "phone - должен быть строкой" })
  phone?: string;

  @ApiProperty({ example: "....", description: "Второй номер телефона" })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    return String(value);
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "phone2 - должен быть строкой" })
  phone2?: string;

  @ApiProperty({ example: "Иван Иванов", description: "Контактное лицо 1" })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    return String(value);
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "contactName1 - должен быть строкой" })
  contactName1?: string;

  @ApiProperty({ example: "Петр Петров", description: "Контактное лицо 2" })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    return String(value);
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "contactName2 - должен быть строкой" })
  contactName2?: string;

  @ApiProperty({
    example: "product_123.jpg",
    description: "Путь к изображению товара",
  })
  @Transform(({ value }) => (value === "" || value === null ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "imagePath - должен быть строкой" })
  imagePath?: string | null;

  @ApiProperty({
    example: "product-2.jpg",
    description: "Второе изображение товара (каталог)",
    required: false,
  })
  @Transform(({ value }) => (value === "" || value === null ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "imagePath2 - должен быть строкой" })
  imagePath2?: string | null;

  @ApiProperty({
    example: "product-3.jpg",
    description: "Третье изображение товара (каталог)",
    required: false,
  })
  @Transform(({ value }) => (value === "" || value === null ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "imagePath3 - должен быть строкой" })
  imagePath3?: string | null;

  @ApiProperty({
    example: false,
    description: "Показывать на публичном каталоге",
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === "" || value === undefined) return undefined;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "showOnWebsite - должно быть boolean" })
  showOnWebsite?: boolean;

  @ApiProperty({
    example: "Характеристики для сайта",
    description: "Длинное описание для публичного каталога",
    required: false,
  })
  @Transform(({ value }) => (value === null ? undefined : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "websiteDescription - должен быть строкой" })
  websiteDescription?: string;

  @ApiProperty({ example: "100", description: "Остаток на начало месяца" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "remainInStart - должен быть числом" })
  remainInStart?: number;

  @ApiProperty({ example: "100", description: "Стоимость на начало месяца" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "costPriceInStart - должен быть числом" })
  costPriceInStart?: number;

  @ApiProperty({
    example: "GRP-01",
    description: "Группа/артикул для начального остатка TMZ (колонка ГруппаАртикул)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "gruppaArtikul - должен быть строкой" })
  gruppaArtikul?: string;

  @ApiProperty({
    example: "125.5",
    description: "Остаток на начало (колонка ОстатокНаНачало)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "ostatokNaNachalo - должен быть числом" })
  ostatokNaNachalo?: number;

  @ApiProperty({
    example: "250000.12",
    description: "Остаток сумма (колонка ОстатокСумма)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "ostatokSumma - должен быть числом" })
  ostatokSumma?: number;

  @ApiProperty({ example: "true", description: "Иностранный счет?" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isForeign - значание должно быть TRUE или FALSE" })
  isForeign?: boolean;

  @ApiProperty({
    example: "г. Ташкент, ул. Промышленная, 123",
    description: "Адрес организации",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "address - должен быть строкой" })
  address?: string;

  @ApiProperty({ example: "123456789", description: "ИНН организации" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : String(value).trim(),
  )
  @ValidateIf((o) => o.isLegalEntity === true)
  @Matches(/^\d{9}$/, {
    message: "inn — 9 цифр",
  })
  inn?: string;

  @ApiProperty({ example: "12345678901234", description: "ЖШШИР физического лица" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : String(value).trim(),
  )
  @IsOptional()
  @ValidateIf(
    (o, v) =>
      o.isIndividualPerson === true &&
      v !== undefined &&
      v !== null &&
      v !== "",
  )
  @Matches(/^\d{14}$/, {
    message: "jshshir — 14 цифр",
  })
  jshshir?: string;

  @ApiProperty({ example: "Spark", description: "Модель автомобиля" })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "carModel - должен быть строкой" })
  carModel?: string;

  @ApiProperty({
    example: "VIP",
    description: "Тип автомобиля - ( VIP || OWN || STRANGER )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(CarType, {
    message: "carType - должен быть из списка типов автомобилей",
  })
  carType?: CarType;

  @ApiProperty({
    example: "PB_PLITA",
    description:
      "Тип производства - ( PB_PLITA || PK_PLITA || BETON || OTHER )",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(ProductionType, {
    message: "productionType - должен быть из списка типов производства",
  })
  productionType?: ProductionType;

  @ApiProperty({
    example: "A",
    description: "Класс цен готовой продукции (A, B, C)",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsEnum(PriceClass, {
    message: "priceClass - должен быть из списка классов цен (A, B, C)",
  })
  priceClass?: PriceClass;

  @ApiProperty({
    example: "2.4",
    description: "Метраж продукции (м) - для расчета зарплаты по ПБ Плита",
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsNumber({}, { message: "productMetr - должен быть числом" })
  productMetr?: number;

  @ApiProperty({
    example: false,
    description: "Автоматический прием межпредприятийных документов",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({
    message: "autoAcceptInterEnterprise - значание должно быть TRUE или FALSE",
  })
  autoAcceptInterEnterprise?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Офисная касса, которая может получать деньги от клиентов других организаций",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isOffice - значание должно быть TRUE или FALSE" })
  isOffice?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Суперкасса - позволяет вводить справочники (партнеры, сотрудники, расходы) от имени других организаций",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "superKassir - значание должно быть TRUE или FALSE" })
  superKassir?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг для COMMON storage - указывает что у этого подразделения есть отдельная касса и отдельная бухгалтерия",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "hasBuxgalter - значание должно быть TRUE или FALSE" })
  hasBuxgalter?: boolean;

  @ApiProperty({
    example: false,
    description: "Основной склад (typeSection STORAGE)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isMainWarehouse - значание должно быть TRUE или FALSE" })
  isMainWarehouse?: boolean;

  @ApiProperty({
    example: false,
    description: "Брак склад (typeSection STORAGE)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isDefectWarehouse - значание должно быть TRUE или FALSE" })
  isDefectWarehouse?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг для материалов, созданных пользователем с ролью MAGAZINE",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsBoolean({ message: "isMagazine - значание должно быть TRUE или FALSE" })
  isMagazine?: boolean;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата создания refValues",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  createdAt?: string | number | null;

  @ApiProperty({
    example: "2025-11-20T06:40:00.475Z",
    description: "Дата обновления refValues",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  updatedAt?: string | number | null;

  @ApiProperty({
    description: "Работы ТМЗ (JSON массив)",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "tmzWorks - должен быть массивом" })
  tmzWorks?: unknown[];

  @ApiProperty({
    description: "Материалы ТМЗ (JSON массив)",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "tmzMaterials - должен быть массивом" })
  tmzMaterials?: unknown[];

  @ApiProperty({
    description: "Технологическая карта ТМЗ (JSON массив)",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "tmzTechMap - должен быть массивом" })
  tmzTechMap?: unknown[];

  @ApiProperty({
    description: "Составные части ТМЗ (JSON массив)",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "tmzComponents - должен быть массивом" })
  tmzComponents?: unknown[];

  @ApiProperty({
    description: "Параметры ценообразования ТМЗ (JSON объект)",
    required: false,
  })
  @IsOptional()
  @IsObject({ message: "tmzPricing - должен быть объектом" })
  tmzPricing?: Record<string, unknown>;

  @ApiProperty({
    description: "Файлы этапа SCALING для ТМЗ (JSON массив)",
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsOptional()
  @IsArray({ message: "filesFromScaling - должен быть массивом" })
  filesFromScaling?: unknown[];

  @ApiProperty({
    description: "Файлы этапа DRAWING для ТМЗ (JSON массив)",
    required: false,
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsOptional()
  @IsArray({ message: "filesFromDrawing - должен быть массивом" })
  filesFromDrawing?: unknown[];

  @ApiProperty({
    example: 10,
    description: "ID производственного цеха (из справочника STORAGES/PRODUCTION)",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "workDeptId - должен быть натуральным числом" })
  workDeptId?: number;

  @ApiProperty({
    example: '{"latitude":41.31,"longitude":69.24}',
    description: "Локация (Telegram / ручной ввод), JSON-строка",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "location - должен быть строкой" })
  location?: string;

  @ApiProperty({
    example: "Стул",
    description: "Краткое наименование ТМЗ",
    required: false,
  })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "shortName - должен быть строкой" })
  shortName?: string | null;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_SHORT_NAME", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "shortNameId - должен быть целым числом" })
  shortNameId?: number;

  @ApiProperty({ example: "M", description: "Размер", required: false })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "size - должен быть строкой" })
  size?: string | null;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_SIZE", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "sizeId - должен быть целым числом" })
  sizeId?: number;

  @ApiProperty({ example: "Красный", description: "Цвет", required: false })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "color - должен быть строкой" })
  color?: string | null;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_COLOR", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "colorId - должен быть целым числом" })
  colorId?: number;

  @ApiProperty({ example: "Матовая", description: "Текстура", required: false })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "texture - должен быть строкой" })
  texture?: string | null;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_TEXTURE", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "textureId - должен быть целым числом" })
  textureId?: number;

  @ApiProperty({
    example: "IKEA",
    description: "Производитель",
    required: false,
  })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((o, v) => v !== undefined && v !== null)
  @IsString({ message: "manufacture - должен быть строкой" })
  manufacture?: string | null;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_MANUFACTURE", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "manufactureId - должен быть целым числом" })
  manufactureId?: number;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_UNIT", required: false })
  @Transform(({ value }) =>
    value === null || value === "" || value === 0 ? undefined : value,
  )
  @IsOptional()
  @IsInt({ message: "unitId - должен быть целым числом" })
  unitId?: number;

  @ApiProperty({
    example: true,
    description: "Листовой материал (учёт раскроя по размерам)",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "isSheetMaterial - значение должно быть TRUE или FALSE" })
  isSheetMaterial?: boolean;

  @ApiProperty({
    example: true,
    description: "Инструмент субаренды (партнёрский)",
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: "isSubleaseTool - значение должно быть TRUE или FALSE" })
  isSubleaseTool?: boolean;

  @ApiProperty({
    example: "PANEL",
    description: "Роль элемента опалубки",
    required: false,
    enum: FormworkKind,
  })
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(FormworkKind, { message: "formworkKind - недопустимое значение" })
  formworkKind?: FormworkKind | null;

  @ApiProperty({
    example: 2,
    description: "Норма расхода комплектующих опалубки",
    required: false,
  })
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({}, { message: "formworkNorm - должно быть числом" })
  formworkNorm?: number | null;

  @ApiProperty({
    example: 2800,
    description: "Высота листового материала, мм",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @IsNumber({}, { message: "height - должно быть числом" })
  height?: number;

  @ApiProperty({
    example: 2070,
    description: "Ширина листового материала, мм",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @IsNumber({}, { message: "width - должно быть числом" })
  width?: number;

  @ApiProperty({
    example: 5.796,
    description: "Площадь листового материала, м²",
    required: false,
  })
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @IsOptional()
  @IsNumber({}, { message: "area - должно быть числом" })
  area?: number;

  @ApiProperty({
    example: "[1,2,3]",
    description:
      "Массив ID производственных цехов (STORAGES/PRODUCTION) для материала",
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "allowedProductionDeptIds - должен быть массивом" })
  @IsNumber(
    {},
    {
      each: true,
      message: "Каждый элемент allowedProductionDeptIds должен быть числом",
    },
  )
  allowedProductionDeptIds?: number[] | null;

  @ApiProperty({
    example: 20,
    description: "Годовой коэффициент амортизации ОС, %",
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "amortizationCoefficient - должно быть числом" })
  amortizationCoefficient?: number;

  @ApiProperty({
    example: "2025-01-01",
    description: "Дата начала начисления амортизации",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "amortizationStartDate - должна быть датой" })
  amortizationStartDate?: string;
}
