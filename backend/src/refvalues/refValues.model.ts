import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  Model,
  Table,
  ForeignKey,
} from "sequelize-typescript";
import {
  TypePartners,
  TypeSECTION,
  TypeTMZ,
  CarType,
  ProductionType,
  PriceClass,
  TypeMediator,
} from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";

interface RefValuesCreationAttrs {
  referenceId: number;
  clientForSectionId?: number;
  partnerId?: number;
  typePartners?: TypePartners;
  referredByMediatorId?: number;
  isMediatorDriver?: boolean;
  isMediatorMaster?: boolean;
  isIndividualPerson?: boolean;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: Date;
  passportIssuedBy?: string;
  isLegalEntity?: boolean;
  bankName?: string;
  bankAccount?: string;
  bankMfo?: string;
  mediatorType?: TypeMediator;
  typeTMZ?: TypeTMZ;
  typeSection?: TypeSECTION;
  unit?: string;
  comment?: string;
  importedFromXlsx?: boolean;
  norma?: number;
  longCharge?: boolean;
  firstPrice?: number;
  secondPrice?: number;
  thirdPrice?: number;
  telegramId?: string;
  countInBox?: number;
  imagePath?: string;
  remainInStart?: number;
  costPriceInStart?: number;
  gruppaArtikul?: string;
  ostatokNaNachalo?: number;
  ostatokSumma?: number;
  isForeign?: boolean;
  address?: string;
  phone?: string;
  inn?: string;
  jshshir?: string;
  carModel?: string;
  carType?: CarType;
  autoAcceptInterEnterprise?: boolean;
  isOffice?: boolean;
  productionType?: ProductionType;
  priceClass?: PriceClass;
  productMetr?: number;
  superKassir?: boolean;
  hasBuxgalter?: boolean;
  isMainWarehouse?: boolean;
  isDefectWarehouse?: boolean;
  isMagazine?: boolean;
  showOnWebsite?: boolean;
  websiteDescription?: string;
  imagePath2?: string;
  imagePath3?: string;
  tmzWorks?: unknown[];
  tmzMaterials?: unknown[];
  tmzTechMap?: unknown[];
  tmzComponents?: unknown[];
  tmzPricing?: Record<string, unknown>;
  filesFromScaling?: unknown[];
  filesFromDrawing?: unknown[];
  workDeptId?: number;
  /** Координаты с Telegram-бота (JSON: latitude, longitude) */
  location?: string;
  shortName?: string;
  shortNameId?: number;
  size?: string;
  sizeId?: number;
  color?: string;
  colorId?: number;
  texture?: string;
  textureId?: number;
  manufacture?: string;
  manufactureId?: number;
  unitId?: number;
  isSheetMaterial?: boolean;
  isSubleaseTool?: boolean;
  formworkKind?: string | null;
  formworkNorm?: number | null;
  height?: number;
  width?: number;
  area?: number;
  allowedProductionDeptIds?: number[] | null;
  amortizationCoefficient?: number;
  amortizationStartDate?: Date;
}

@Table({ tableName: "refvalues" })
export class RefValues extends Model<RefValues, RefValuesCreationAttrs> {
  @ApiProperty({ example: "1", description: "Уникальный иденфикатор" })
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Reference)
  @ApiProperty({ example: "12222", description: "Идентификатор справочника" })
  @Column({ type: DataType.INTEGER })
  referenceId: number;

  @BelongsTo(() => Reference)
  reference: Reference;

  @ApiProperty({
    example: "12222",
    description: "Кому относится клиент - идентификатор подразделения",
  })
  @Column({ type: DataType.INTEGER })
  clientForSectionId?: number;

  @ApiProperty({
    example: 1,
    description: "Партнёр для склада субаренды (PARTNER_TOOLS)",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  partnerId?: number;

  @ApiProperty({
    example: "CLIENTS",
    description: "Тип партнера - ( CLIENTS || SUPPLIERS )",
  })
  @Column({ type: DataType.ENUM(...Object.values(TypePartners)) })
  typePartners?: TypePartners;

  @ApiProperty({
    example: 1,
    description: "ID посредника, привлёкшего клиента",
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  referredByMediatorId?: number;

  @ApiProperty({ example: false, description: "Воситачи — водитель" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isMediatorDriver?: boolean;

  @ApiProperty({ example: false, description: "Воситачи — мастер" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isMediatorMaster?: boolean;

  @ApiProperty({ example: false, description: "Физическое лицо" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isIndividualPerson?: boolean;

  @ApiProperty({ example: "AA", description: "Серия паспорта (2 латинские буквы)" })
  @Column({ type: DataType.STRING(2), allowNull: true })
  passportSeries?: string;

  @ApiProperty({ example: "1234567", description: "Номер паспорта (7 цифр)" })
  @Column({ type: DataType.STRING(7), allowNull: true })
  passportNumber?: string;

  @ApiProperty({ example: "2015-06-01", description: "Дата выдачи паспорта" })
  @Column({ type: DataType.DATEONLY, allowNull: true })
  passportIssueDate?: Date;

  @ApiProperty({ example: "ИИБ Мирабадского р-на", description: "Кем выдан паспорт" })
  @Column({ type: DataType.STRING(500), allowNull: true })
  passportIssuedBy?: string;

  @ApiProperty({ example: false, description: "Юридическое лицо" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isLegalEntity?: boolean;

  @ApiProperty({ example: "Асака банк", description: "Наименование банка" })
  @Column({ type: DataType.STRING(255), allowNull: true })
  bankName?: string;

  @ApiProperty({ example: "20208000123456789012", description: "Расчётный счёт (20 цифр)" })
  @Column({ type: DataType.STRING(20), allowNull: true })
  bankAccount?: string;

  @ApiProperty({ example: "00401", description: "МФО банка (5 цифр)" })
  @Column({ type: DataType.STRING(5), allowNull: true })
  bankMfo?: string;

  @ApiProperty({
    example: "DRIVER",
    description: "Тип посредника - ( DRIVER || MASTER )",
  })
  @Column({ type: DataType.ENUM(...Object.values(TypeMediator)) })
  mediatorType?: TypeMediator;

  @ApiProperty({
    example: "MATERIAL",
    description:
      "Тип ТМЗ - ( MATERIAL || PRODUCT || HALFSTUFF || OS || TOOLS || TOVAR )",
  })
  @Column({ type: DataType.ENUM(...Object.values(TypeTMZ)) })
  typeTMZ?: TypeTMZ;

  @ApiProperty({
    example: "CASH",
    description:
      "Тип подразделения (COMMON, CASH, BANK, PLASTIK, FOUNDER, PRODUCTION, STORAGE)",
  })
  @Column({ type: DataType.ENUM(...Object.values(TypeSECTION)) })
  typeSection?: TypeSECTION;

  @ApiProperty({ example: "кг", description: "Единица измерения" })
  @Column({ type: DataType.STRING })
  unit?: string;

  @ApiProperty({ example: "Стул", description: "Краткое наименование ТМЗ" })
  @Column({ type: DataType.STRING, allowNull: true })
  shortName?: string;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_SHORT_NAME" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  shortNameId?: number;

  @ApiProperty({ example: "M", description: "Размер" })
  @Column({ type: DataType.STRING, allowNull: true })
  size?: string;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_SIZE" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  sizeId?: number;

  @ApiProperty({ example: "Красный", description: "Цвет" })
  @Column({ type: DataType.STRING, allowNull: true })
  color?: string;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_COLOR" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  colorId?: number;

  @ApiProperty({ example: "Матовая", description: "Текстура" })
  @Column({ type: DataType.STRING, allowNull: true })
  texture?: string;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_TEXTURE" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  textureId?: number;

  @ApiProperty({ example: "IKEA", description: "Производитель" })
  @Column({ type: DataType.STRING, allowNull: true })
  manufacture?: string;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_MANUFACTURE" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  manufactureId?: number;

  @ApiProperty({ example: 1, description: "ID справочника TMZ_UNIT" })
  @Column({ type: DataType.INTEGER, allowNull: true })
  unitId?: number;

  @ApiProperty({
    example: true,
    description: "Листовой материал (учёт раскроя по размерам)",
  })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isSheetMaterial?: boolean;

  @ApiProperty({
    example: true,
    description: "Инструмент субаренды (партнёрский, без остатка на нашем складе)",
  })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isSubleaseTool?: boolean;

  @ApiProperty({
    example: "PANEL",
    description:
      "Роль элемента опалубки: PANEL, CORNER_OUTER, CORNER_INNER, LOCK, BRACE, TIE",
    required: false,
  })
  @Column({ type: DataType.STRING(16), allowNull: true })
  formworkKind?: string | null;

  @ApiProperty({
    example: 2,
    description:
      "Норма расхода опалубки: LOCK — шт. на стык, BRACE — шт. на метр контура на ярус, TIE — шт. на щит",
    required: false,
  })
  @Column({ type: DataType.DECIMAL(18, 4), allowNull: true })
  formworkNorm?: number | null;

  @ApiProperty({
    example: 2800,
    description: "Высота листового материала, мм",
  })
  @Column({ type: DataType.DECIMAL(18, 4), allowNull: true })
  height?: number;

  @ApiProperty({
    example: 2070,
    description: "Ширина листового материала, мм",
  })
  @Column({ type: DataType.DECIMAL(18, 4), allowNull: true })
  width?: number;

  @ApiProperty({
    example: 5.796,
    description: "Площадь листового материала, м² (Высота * Ширина / 1 000 000)",
  })
  @Column({ type: DataType.DECIMAL(18, 6), allowNull: true })
  area?: number;

  @ApiProperty({
    example: "[1,2,3]",
    description:
      "Массив ID производственных цехов (STORAGES/PRODUCTION), где может использоваться материал",
    required: false,
  })
  @Column({ type: DataType.JSON, allowNull: true })
  allowedProductionDeptIds?: number[] | null;

  @ApiProperty({
    example: 20,
    description: "Годовой коэффициент амортизации ОС, %",
  })
  @Column({ type: DataType.DECIMAL(10, 4), allowNull: true })
  amortizationCoefficient?: number;

  @ApiProperty({
    example: "2025-01-01",
    description: "Дата начала начисления амортизации",
  })
  @Column({ type: DataType.DATEONLY, allowNull: true })
  amortizationStartDate?: Date;

  @ApiProperty({ example: "....", description: "Комментарий" })
  @Column({ type: DataType.STRING })
  comment?: string;

  @ApiProperty({ example: "false", description: "Помечан на удаление?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  markToDeleted?: boolean;

  @ApiProperty({
    example: false,
    description: "Импортирован из Excel (Список контрагентов)",
  })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  importedFromXlsx?: boolean;

  @ApiProperty({
    example: "1.35",
    description: "Норма затрат на ед. материала?",
  })
  @Column({ type: DataType.FLOAT })
  norma?: number;

  @ApiProperty({ example: "true", description: "Долгосрочный тип затрат?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  longCharge?: boolean;

  @ApiProperty({ example: "3400", description: "Первая цена" })
  @Column({ type: DataType.FLOAT })
  firstPrice?: number;

  @ApiProperty({ example: "3800", description: "Вторая цена" })
  @Column({ type: DataType.FLOAT })
  secondPrice?: number;

  @ApiProperty({ example: "4000", description: "Третья цена" })
  @Column({ type: DataType.FLOAT })
  thirdPrice?: number;

  @ApiProperty({ example: "12", description: "Количество в коробке" })
  @Column({ type: DataType.INTEGER })
  countInBox?: number;

  @ApiProperty({ example: "....", description: "Id телеграм" })
  @Column({ type: DataType.STRING })
  telegramId?: string;

  @ApiProperty({ example: "....", description: "Номер телефона" })
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  phone?: string;

  @ApiProperty({ example: "....", description: "Второй номер телефона" })
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  phone2?: string;

  @ApiProperty({ example: "Иван Иванов", description: "Контактное лицо 1" })
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: "contactName1",
  })
  contactName1?: string;

  @ApiProperty({ example: "Петр Петров", description: "Контактное лицо 2" })
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: "contactName2",
  })
  contactName2?: string;

  @ApiProperty({
    example: "product_123.jpg",
    description: "Путь к изображению товара",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  imagePath?: string;

  @ApiProperty({ example: "100", description: "Остаток на начало месяца" })
  @Column({ type: DataType.INTEGER })
  remainInStart?: number;

  @ApiProperty({ example: "100", description: "Стоимость на начало месяца" })
  @Column({ type: DataType.FLOAT })
  costPriceInStart?: number;

  @ApiProperty({
    example: "GRP-01",
    description: "Группа/артикул для ввода начального остатка (TMZ)",
    required: false,
  })
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: "ГруппаАртикул",
  })
  gruppaArtikul?: string;

  @ApiProperty({
    example: "125.5",
    description: "Остаток на начало (количество), TMZ",
    required: false,
  })
  @Column({
    type: DataType.DECIMAL(18, 6),
    allowNull: true,
    field: "ОстатокНаНачало",
  })
  ostatokNaNachalo?: number;

  @ApiProperty({
    example: "250000.12",
    description: "Остаток сумма на начало, TMZ",
    required: false,
  })
  @Column({
    type: DataType.DECIMAL(18, 6),
    allowNull: true,
    field: "ОстатокСумма",
  })
  ostatokSumma?: number;

  @ApiProperty({ example: "true", description: "Иностранный товар?" })
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  isForeign?: boolean;

  @ApiProperty({
    example: "г. Ташкент, ул. Промышленная, 123",
    description: "Адрес организации",
  })
  @Column({ type: DataType.STRING, allowNull: true })
  address?: string;

  @ApiProperty({ example: "123456789", description: "ИНН организации" })
  @Column({ type: DataType.STRING, allowNull: true })
  inn?: string;

  @ApiProperty({ example: "12345678901234", description: "ЖШШИР физического лица" })
  @Column({ type: DataType.STRING(14), allowNull: true })
  jshshir?: string;

  @ApiProperty({ example: "Spark", description: "Модель автомобиля" })
  @Column({ type: DataType.STRING, allowNull: true })
  carModel?: string;

  @ApiProperty({
    example: "VIP",
    description: "Тип автомобиля - ( VIP || OWN || STRANGER )",
  })
  @Column({ type: DataType.ENUM(...Object.values(CarType)), allowNull: true })
  carType?: CarType;

  @ApiProperty({
    example: false,
    description: "Автоматический прием межпредприятийных документов",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  autoAcceptInterEnterprise?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Офисная касса, которая может получать деньги от клиентов других организаций",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  isOffice?: boolean;

  @ApiProperty({
    example: "OTHER",
    description: "Тип продукции для расчета ЗП",
    required: false,
  })
  @Column({
    type: DataType.ENUM(...Object.values(ProductionType)),
    allowNull: true,
    defaultValue: ProductionType.OTHER,
  })
  productionType?: ProductionType;

  @ApiProperty({
    example: "A",
    description: "Класс цен готовой продукции (A, B, C)",
    required: false,
  })
  @Column({
    type: DataType.ENUM(...Object.values(PriceClass)),
    allowNull: true,
  })
  priceClass?: PriceClass;

  @ApiProperty({
    example: 0.5,
    description: "Метраж для продукции типа ПБ Плита",
    required: false,
  })
  @Column({ type: DataType.FLOAT, allowNull: true })
  productMetr?: number;

  @ApiProperty({
    example: false,
    description:
      "Суперкасса - позволяет вводить справочники (партнеры, сотрудники, расходы) от имени других организаций",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  superKassir?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг для COMMON storage - указывает что у этого подразделения есть отдельная касса и отдельная бухгалтерия",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  hasBuxgalter?: boolean;

  @ApiProperty({
    example: false,
    description: "Основной склад (typeSection STORAGE)",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  isMainWarehouse?: boolean;

  @ApiProperty({
    example: false,
    description: "Брак склад (typeSection STORAGE)",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  isDefectWarehouse?: boolean;

  @ApiProperty({
    example: false,
    description:
      "Флаг для материалов, созданных пользователем с ролью MAGAZINE",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: false })
  isMagazine?: boolean;

  @ApiProperty({
    example: false,
    description: "Показывать позицию на публичном каталоге сайта",
    required: false,
  })
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  showOnWebsite?: boolean;

  @ApiProperty({
    example: "Размеры, материал…",
    description: "Описание / характеристики для публичного каталога",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  websiteDescription?: string;

  @ApiProperty({
    example: "product-2.jpg",
    description: "Второе изображение товара (каталог)",
    required: false,
  })
  @Column({ type: DataType.STRING(255), allowNull: true })
  imagePath2?: string;

  @ApiProperty({
    example: "product-3.jpg",
    description: "Третье изображение товара (каталог)",
    required: false,
  })
  @Column({ type: DataType.STRING(255), allowNull: true })
  imagePath3?: string;

  @ApiProperty({
    description: "Работы ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  tmzWorks?: unknown[];

  @ApiProperty({
    description: "Материалы ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  tmzMaterials?: unknown[];

  @ApiProperty({
    description: "Технологическая карта ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  tmzTechMap?: unknown[];

  @ApiProperty({
    description: "Составные части ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  tmzComponents?: unknown[];

  @ApiProperty({
    description: "Ценообразование ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  tmzPricing?: Record<string, unknown>;

  @ApiProperty({
    description: "Файлы SCALING для ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  filesFromScaling?: unknown[];

  @ApiProperty({
    description: "Файлы DRAWING для ТМЗ (JSON)",
    required: false,
  })
  @Column({ type: DataType.JSONB, allowNull: true })
  filesFromDrawing?: unknown[];

  @ApiProperty({
    example: 10,
    description: "ID производственного цеха (из справочника STORAGES/PRODUCTION)",
    required: false,
  })
  @Column({ type: DataType.INTEGER, allowNull: true })
  workDeptId?: number;

  @ApiProperty({
    example: '{"latitude":41.31,"longitude":69.24}',
    description: "Локация клиента (Telegram), JSON-строка",
    required: false,
  })
  @Column({ type: DataType.TEXT, allowNull: true })
  location?: string;
}
