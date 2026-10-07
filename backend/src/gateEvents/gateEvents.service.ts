import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ConfigService } from "@nestjs/config";
import { GateEvent, GateEventType, GateAction } from "./gateEvent.model";
import { Reference } from "../references/reference.model";
import { RefValues } from "../refvalues/refValues.model";
import { Document } from "../documents/document.model";
import { DocValues } from "../docValues/docValues.model";
import { DocTableItems } from "../docTableItems/docTableItems.model";
import { TypeReference, CarType } from "../interfaces/reference.interface";
import { DocumentType, DocSTATUS } from "../interfaces/document.interface";
import { CameraEventDto } from "./dto/camera-event.dto";
import { GateGateway } from "./gate-gateway";
import * as fs from "fs";
import * as path from "path";
import { Op } from "sequelize";

@Injectable()
export class GateEventsService {
  private readonly logger = new Logger(GateEventsService.name);

  constructor(
    @InjectModel(GateEvent)
    private gateEventRepository: typeof GateEvent,
    @InjectModel(Reference)
    private referenceRepository: typeof Reference,
    @InjectModel(RefValues)
    private refValuesRepository: typeof RefValues,
    @InjectModel(Document)
    private documentRepository: typeof Document,
    @InjectModel(DocValues)
    private docValuesRepository: typeof DocValues,
    private configService: ConfigService,
    @Inject(forwardRef(() => GateGateway)) private gateGateway: GateGateway,
  ) {}

  /**
   * Обработка события от камеры
   */
  async processCameraEvent(cameraEventDto: CameraEventDto): Promise<GateEvent> {
    this.logger.log(
      `🎯 Обработка события от камеры: ${cameraEventDto.plateNumber} (${cameraEventDto.eventType})`,
    );
    this.logger.log(
      `   📅 Время события: ${new Date(cameraEventDto.timestamp).toISOString()}`,
    );
    this.logger.log(`   📡 IP камеры: ${cameraEventDto.cameraIp}`);
    this.logger.log(
      `   🚗 Тип ТС: ${cameraEventDto.vehicleType || "не указан"}`,
    );

    try {
      // 0. Проверка на дублирование событий
      const duplicateEvent = await this.checkForDuplicateEvent(cameraEventDto);
      if (duplicateEvent) {
        const timeWindowSeconds = parseInt(
          process.env.DUPLICATE_CHECK_WINDOW_SECONDS || "30",
        );
        this.logger.warn(
          `🔄 Обнаружено дублирующееся событие для номера ${cameraEventDto.plateNumber} (${cameraEventDto.eventType}) в течение последних ${timeWindowSeconds} секунд`,
        );
        this.logger.warn(
          `   Существующее событие ID: ${duplicateEvent.id}, время: ${new Date(Number(duplicateEvent.eventTime)).toISOString()}`,
        );
        this.logger.warn(
          `   Новое событие время: ${new Date(cameraEventDto.timestamp).toISOString()}`,
        );
        return duplicateEvent; // Возвращаем существующее событие
      }

      // 1. Найти или создать автомобиль
      const carReference = await this.findOrCreateCarByPlateNumber(
        cameraEventDto.plateNumber,
      );

      // 2. Сохранить изображения если есть
      let imagePath: string | undefined;
      let plateImagePath: string | undefined;

      if (cameraEventDto.imageBase64) {
        imagePath = await this.saveVehicleImage(
          cameraEventDto.imageBase64,
          cameraEventDto.plateNumber,
          "detection",
        );
      }

      if (cameraEventDto.plateImageBase64) {
        plateImagePath = await this.saveVehicleImage(
          cameraEventDto.plateImageBase64,
          cameraEventDto.plateNumber,
          "plate",
        );
      }

      // 3. Определить действие шлагбаума
      const gateAction = await this.determineGateAction(
        cameraEventDto.eventType,
        carReference.id,
        cameraEventDto.timestamp,
      );

      // 4. Создать запись события
      const eventTimeBigInt = BigInt(cameraEventDto.timestamp);

      // Логируем данные перед сохранением в базу
      this.logger.log(`💾 Сохранение события в базу:`);
      this.logger.log(`   Номер: ${cameraEventDto.plateNumber}`);
      this.logger.log(`   Тип: ${cameraEventDto.eventType}`);
      this.logger.log(`   Timestamp: ${cameraEventDto.timestamp}`);

      // Конвертируем timestamp в читаемый формат
      const timestampDate = new Date(cameraEventDto.timestamp);
      this.logger.log(`   Время события: ${timestampDate.toISOString()}`);

      // Получаем enterpriseId из carReference или используем дефолтное значение 1
      const enterpriseId = carReference.enterpriseId ?? 1;
      this.logger.log(`   EnterpriseId: ${enterpriseId}`);

      const gateEvent = await this.gateEventRepository.create({
        enterpriseId: enterpriseId,
        carId: carReference.id,
        plateNumber: cameraEventDto.plateNumber,
        eventType: cameraEventDto.eventType,
        eventTime: eventTimeBigInt,
        cameraIp: cameraEventDto.cameraIp,
        vehicleType: cameraEventDto.vehicleType,
        vehicleColor: cameraEventDto.vehicleColor,
        imagePath,
        plateImagePath,
        gateAction: gateAction.action,
        denialReason: gateAction.reason,
        leaveProdDocId: gateAction.leaveProdDocId,
        processed: false,
      });

      this.logger.log(
        `✅ Событие создано с ID: ${gateEvent.id}, действие: ${gateAction.action}`,
      );
      this.logger.log(
        `   📊 Статистика: изображение=${imagePath ? "сохранено" : "отсутствует"}, номер=${plateImagePath ? "сохранен" : "отсутствует"}`,
      );

      // Шлем фронтендам событие о создании нового события КПП
      try {
        this.gateGateway?.server?.emit("gate_event_created", {
          ...gateEvent.get({ plain: true }),
        });
      } catch (emitError) {
        this.logger.warn(
          `Не удалось отправить websocket событие gate_event_created: ${emitError?.message || emitError}`,
        );
      }

      // Отправляем команду через WebSocket если шлагбаум должен открыться
      if (gateAction.action === GateAction.OPENED) {
        await this.sendGateCommand(gateEvent);

        // Если это въезд (INCOME) и есть документ GateIncome, помечаем его как использованный
        if (
          cameraEventDto.eventType === GateEventType.INCOME &&
          gateAction.leaveProdDocId
        ) {
          await this.markIncomeAsCompleted(
            carReference.id,
            BigInt(cameraEventDto.timestamp),
          );
        }

        // Если это выезд (OUTCOME) и не VIP машина, помечаем выезд как завершенный
        if (
          cameraEventDto.eventType === GateEventType.OUTCOME &&
          gateAction.leaveProdDocId
        ) {
          await this.markExitAsCompleted(
            carReference.id,
            BigInt(cameraEventDto.timestamp),
          );
        }
      }

      return gateEvent;
    } catch (error) {
      this.logger.error(
        `Ошибка обработки события от камеры: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Найти или создать автомобиль по госномеру
   */
  async findOrCreateCarByPlateNumber(plateNumber: string): Promise<Reference> {
    // Проверяем, что номер не пустой
    if (!plateNumber || plateNumber.trim() === "") {
      this.logger.warn(
        'Пустой номер автомобиля, создаем запись с номером "UNKNOWN"',
      );
      plateNumber = "UNKNOWN";
    }

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
      enterpriseId: 1, // Дефолтное предприятие для автомобилей, созданных системой КПП
    });

    // Создание связанных RefValues
    await this.refValuesRepository.create({
      referenceId: newCar.id,
      carType: CarType.STRANGER,
      comment: "Автоматически создан системой КПП",
    });

    this.logger.log(
      `Создан новый автомобиль: ${plateNumber} (ID: ${newCar.id})`,
    );
    return newCar;
  }

  /**
   * Получить тип машины
   */
  private async getCarType(carId: number): Promise<CarType | null> {
    const carReference = await this.referenceRepository.findOne({
      where: { id: carId },
      include: [
        {
          model: RefValues,
          required: true,
        },
      ],
    });

    if (!carReference || !carReference.refValues) {
      return null;
    }

    return carReference.refValues.carType || CarType.STRANGER;
  }

  /**
   * Проверка является ли машина VIP
   */
  private async isVipCar(carId: number): Promise<boolean> {
    const carType = await this.getCarType(carId);
    return carType === CarType.VIP;
  }

  /**
   * Проверка на дублирование событий
   */
  private async checkForDuplicateEvent(
    cameraEventDto: CameraEventDto,
  ): Promise<GateEvent | null> {
    try {
      // Ищем события с тем же номером, типом и IP камеры в течение последних N секунд
      // Можно настроить через переменную окружения DUPLICATE_CHECK_WINDOW_SECONDS (по умолчанию 30)
      const timeWindowSeconds = parseInt(
        process.env.DUPLICATE_CHECK_WINDOW_SECONDS || "30",
      );
      const timeWindow = timeWindowSeconds * 1000; // конвертируем в миллисекунды
      const eventTime = cameraEventDto.timestamp;
      const timeStart = eventTime - timeWindow;
      const timeEnd = eventTime + timeWindow;

      this.logger.debug(
        `🔍 Проверка дублирования: номер=${cameraEventDto.plateNumber}, тип=${cameraEventDto.eventType}, IP=${cameraEventDto.cameraIp}`,
      );
      this.logger.debug(
        `   Временное окно: ${new Date(timeStart).toISOString()} - ${new Date(timeEnd).toISOString()}`,
      );

      const duplicateEvent = await this.gateEventRepository.findOne({
        where: {
          plateNumber: cameraEventDto.plateNumber,
          eventType: cameraEventDto.eventType,
          cameraIp: cameraEventDto.cameraIp,
          eventTime: {
            [Op.between]: [BigInt(timeStart), BigInt(timeEnd)],
          },
        },
        order: [["createdAt", "DESC"]], // Берем самое последнее событие
      });

      if (duplicateEvent) {
        this.logger.debug(
          `🔍 Найдено потенциальное дублирование: ID=${duplicateEvent.id}, время=${new Date(Number(duplicateEvent.eventTime)).toISOString()}`,
        );
      } else {
        this.logger.debug(`🔍 Дублирование не найдено - продолжаем обработку`);
      }

      return duplicateEvent;
    } catch (error) {
      this.logger.error(
        `Ошибка при проверке дублирования событий: ${error.message}`,
      );
      return null; // В случае ошибки продолжаем обработку
    }
  }

  /**
   * Определить действие шлагбаума
   */
  private async determineGateAction(
    eventType: GateEventType,
    carId: number,
    eventTime: number,
  ): Promise<{ action: GateAction; reason?: string; leaveProdDocId?: bigint }> {
    const carType = await this.getCarType(carId);

    // Если тип машины не определен, обрабатываем как STRANGER (требуется документ)
    if (!carType) {
      this.logger.warn(
        `Тип машины не определен для ID: ${carId}, обрабатываем как STRANGER`,
      );
    }

    if (eventType === GateEventType.INCOME) {
      // 1. VIP машины - въезд без условий
      if (carType === CarType.VIP) {
        this.logger.log(`VIP машина ID: ${carId} - разрешен въезд без условий`);
        return { action: GateAction.OPENED };
      }

      // 2. OWN машины - въезд без условий
      if (carType === CarType.OWN) {
        this.logger.log(`OWN машина ID: ${carId} - разрешен въезд без условий`);
        return { action: GateAction.OPENED };
      }

      // 3. STRANGER машины (или неопределенный тип) - требуется единоразовый документ GateIncome
      const incomeDoc = await this.checkIncomeDocument(
        carId,
        BigInt(eventTime),
      );

      if (incomeDoc) {
        this.logger.log(
          `STRANGER машина ID: ${carId} - найден документ GateIncome, разрешен въезд`,
        );
        return {
          action: GateAction.OPENED,
          leaveProdDocId: incomeDoc.id,
        };
      } else {
        this.logger.log(
          `STRANGER машина ID: ${carId} - документ GateIncome не найден, въезд запрещен`,
        );
        return {
          action: GateAction.DENIED,
          reason: "Нет накладной для входа (GateIncome)",
        };
      }
    }

    if (eventType === GateEventType.OUTCOME) {
      // 1. VIP машины - выезд без условий
      if (carType === CarType.VIP) {
        this.logger.log(`VIP машина ID: ${carId} - разрешен выезд без условий`);
        return { action: GateAction.OPENED };
      }

      // 2. OWN и STRANGER машины (или неопределенный тип) - требуется документ для выезда
      const exitDoc = await this.checkExitDocument(carId, BigInt(eventTime));

      if (exitDoc) {
        this.logger.log(
          `Машина ID: ${carId} (тип: ${carType || "неопределен"}) - найден документ SaleProd, разрешен выезд`,
        );
        return {
          action: GateAction.OPENED,
          leaveProdDocId: exitDoc.id,
        };
      } else {
        this.logger.log(
          `Машина ID: ${carId} (тип: ${carType || "неопределен"}) - документ SaleProd не найден, выезд запрещен`,
        );
        return {
          action: GateAction.DENIED,
          reason: "Нет документа SaleProd для выезда",
        };
      }
    }

    return { action: GateAction.PENDING };
  }

  /**
   * Проверка единоразового документа для въезда (GateIncome)
   */
  async checkIncomeDocument(
    carId: number,
    eventTime: bigint,
  ): Promise<Document | null> {
    // Получаем начало и конец текущего дня
    const eventDate = new Date(Number(eventTime));
    const todayStart = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const incomeDoc = await this.documentRepository.findOne({
      where: {
        documentType: DocumentType.GateIncome,
        docStatus: {
          [Op.in]: [DocSTATUS.OPEN, DocSTATUS.PENDING, DocSTATUS.PROVEDEN],
        },
        date: {
          [Op.gte]: BigInt(todayStart.getTime()),
          [Op.lte]: BigInt(todayEnd.getTime()),
        },
      },
      include: [
        {
          model: DocValues,
          where: {
            carId,
            [Op.or]: [{ incomeCompleted: false }, { incomeCompleted: null }],
          },
          required: true,
        },
      ],
      order: [["date", "DESC"]],
    });

    if (incomeDoc) {
      this.logger.log(
        `Найден документ GateIncome (статус: ${incomeDoc.docStatus}) для въезда автомобиля ID: ${carId}, документ ID: ${incomeDoc.id}`,
      );
    } else {
      this.logger.log(
        `Документ GateIncome для въезда не найден для автомобиля ID: ${carId}`,
      );
    }

    return incomeDoc;
  }

  /**
   * Проверка документа для выезда (SaleProd)
   */
  async checkExitDocument(
    carId: number,
    eventTime: bigint,
  ): Promise<Document | null> {
    // Получаем начало и конец текущего дня
    const eventDate = new Date(Number(eventTime));
    const todayStart = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const exitDoc = await this.documentRepository.findOne({
      where: {
        documentType: DocumentType.SaleProd,
        docStatus: {
          [Op.in]: [DocSTATUS.PROVEDEN, DocSTATUS.PENDING],
        },
        date: {
          [Op.gte]: BigInt(todayStart.getTime()),
          [Op.lte]: BigInt(todayEnd.getTime()),
        },
      },
      include: [
        {
          model: DocValues,
          where: {
            carId,
            [Op.or]: [{ exitCompleted: false }, { exitCompleted: null }],
          },
          required: true,
        },
      ],
      order: [["date", "DESC"]],
    });

    if (exitDoc) {
      this.logger.log(
        `Найден документ ${exitDoc.documentType} (статус: ${exitDoc.docStatus}) для автомобиля ID: ${carId}, документ ID: ${exitDoc.id}`,
      );
    } else {
      this.logger.log(
        `Документ для выезда не найден для автомобиля ID: ${carId}`,
      );
    }

    return exitDoc;
  }

  /**
   * Пометить накладную для входа как использованную (единоразовый документ)
   * и автоматически провести документ (установить статус PROVEDEN)
   */
  private async markIncomeAsCompleted(
    carId: number,
    eventTime: bigint,
  ): Promise<void> {
    try {
      // Получаем начало и конец текущего дня
      const eventDate = new Date(Number(eventTime));
      const todayStart = new Date(
        eventDate.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate(),
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Находим документ и связанную запись docValues
      // Ищем документы со статусом OPEN, PENDING или PROVEDEN (на случай если уже проведен)
      const document = await this.documentRepository.findOne({
        where: {
          documentType: DocumentType.GateIncome,
          docStatus: {
            [Op.in]: [DocSTATUS.OPEN, DocSTATUS.PENDING, DocSTATUS.PROVEDEN],
          },
          date: {
            [Op.gte]: BigInt(todayStart.getTime()),
            [Op.lte]: BigInt(todayEnd.getTime()),
          },
        },
        include: [
          {
            model: DocValues,
            where: {
              carId,
              [Op.or]: [{ incomeCompleted: false }, { incomeCompleted: null }],
            },
            required: true,
          },
        ],
      });

      if (document && document.docValues) {
        // Помечаем документ как использованный (единоразовый)
        await this.docValuesRepository.update(
          { incomeCompleted: true },
          { where: { id: document.docValues.id } },
        );

        // Автоматически проводим документ (устанавливаем статус PROVEDEN)
        // Только если документ еще не проведен
        if (document.docStatus !== DocSTATUS.PROVEDEN) {
          await this.documentRepository.update(
            { docStatus: DocSTATUS.PROVEDEN },
            { where: { id: document.id } },
          );
          this.logger.log(
            `Документ GateIncome автоматически проведен (ID: ${document.id}) для машины ID: ${carId}`,
          );
        }

        this.logger.log(
          `Накладная для входа отмечена как использованная для машины ID: ${carId}, документ ID: ${document.id}`,
        );
      } else {
        this.logger.warn(
          `Не удалось найти документ GateIncome для пометки как использованного для машины ID: ${carId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при пометке накладной для входа как использованной: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Пометить выезд как завершенный
   */
  private async markExitAsCompleted(
    carId: number,
    eventTime: bigint,
  ): Promise<void> {
    try {
      // Получаем начало и конец текущего дня
      const eventDate = new Date(Number(eventTime));
      const todayStart = new Date(
        eventDate.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate(),
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Находим документ и связанную запись docValues
      const document = await this.documentRepository.findOne({
        where: {
          documentType: DocumentType.SaleProd,
          docStatus: {
            [Op.in]: [DocSTATUS.PROVEDEN, DocSTATUS.PENDING],
          },
          date: {
            [Op.gte]: BigInt(todayStart.getTime()),
            [Op.lte]: BigInt(todayEnd.getTime()),
          },
        },
        include: [
          {
            model: DocValues,
            where: {
              carId,
              [Op.or]: [{ exitCompleted: false }, { exitCompleted: null }],
            },
            required: true,
          },
        ],
      });

      if (document && document.docValues) {
        // Обновляем статус выезда
        await this.docValuesRepository.update(
          { exitCompleted: true },
          { where: { id: document.docValues.id } },
        );

        this.logger.log(
          `Выезд отмечен как завершенный для машины ID: ${carId}, документ: ${document.documentType} (статус: ${document.docStatus}) ID: ${document.id}`,
        );
      } else {
        this.logger.warn(
          `Не удалось найти документ для пометки выезда как завершенного для машины ID: ${carId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка при пометке выезда как завершенного: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Сохранение изображения автомобиля
   */
  private async saveVehicleImage(
    imageBase64: string,
    plateNumber: string,
    imageType: "detection" | "plate" = "detection",
  ): Promise<string | undefined> {
    try {
      this.logger.log(
        `Начинаем сохранение ${imageType} изображения для номера: ${plateNumber}`,
      );

      // Создаем директорию для изображений
      const uploadDir = path.join(process.cwd(), "uploads", "gate");
      if (!fs.existsSync(uploadDir)) {
        try {
          fs.mkdirSync(uploadDir, { recursive: true });
          this.logger.debug(
            `Создана основная директория для изображений: ${uploadDir}`,
          );
        } catch (mkdirError) {
          this.logger.error(
            `Не удалось создать основную директорию ${uploadDir}: ${mkdirError.message}`,
          );
          this.logger.error(
            `Проверьте права доступа к папке uploads. Запустите скрипт fix-upload-permissions.ps1 (Windows) или fix-upload-permissions.sh (Linux)`,
          );
          return undefined;
        }
      }

      // Проверяем права доступа к директории
      try {
        const testFile = path.join(uploadDir, ".test_write_permission");
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        this.logger.debug(
          `✅ Права на запись в директорию ${uploadDir} подтверждены`,
        );
      } catch (permissionError) {
        this.logger.error(
          `❌ Нет прав на запись в директорию ${uploadDir}: ${permissionError.message}`,
        );
        this.logger.error(
          `🔧 Решение: Запустите скрипт fix-upload-permissions.ps1 (Windows) или fix-upload-permissions.sh (Linux)`,
        );
        return undefined;
      }

      // Создаем поддиректорию по дате
      const dateDir = new Date().toISOString().split("T")[0];
      const datePath = path.join(uploadDir, dateDir);
      if (!fs.existsSync(datePath)) {
        try {
          fs.mkdirSync(datePath, { recursive: true });
          this.logger.debug(`Создана директория для изображений: ${datePath}`);
        } catch (mkdirError) {
          this.logger.error(
            `Не удалось создать директорию ${datePath}: ${mkdirError.message}`,
          );
          return undefined;
        }
      }

      // Извлекаем данные из base64 с улучшенной обработкой
      let base64Data: string;
      if (imageBase64.startsWith("data:image/")) {
        // Убираем префикс data:image/...;base64,
        base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        this.logger.debug(
          `Извлечены base64 данные с префиксом, размер: ${base64Data.length} символов`,
        );
      } else {
        // Предполагаем, что это уже чистые base64 данные
        base64Data = imageBase64;
        this.logger.debug(
          `Используем base64 данные как есть, размер: ${base64Data.length} символов`,
        );
      }

      // Проверяем валидность base64
      if (!this.isValidBase64(base64Data)) {
        this.logger.error(`Невалидные base64 данные для номера ${plateNumber}`);
        return undefined;
      }

      // Конвертируем в Buffer
      const buffer = Buffer.from(base64Data, "base64");
      this.logger.debug(`Создан Buffer размером: ${buffer.length} байт`);

      // Дополнительная проверка целостности Base64
      const reencodedBase64 = buffer.toString("base64");
      if (reencodedBase64 !== base64Data) {
        this.logger.warn(
          `⚠️ Base64 данные повреждены при декодировании для номера ${plateNumber}`,
        );
        this.logger.debug(`Оригинал: ${base64Data.substring(0, 50)}...`);
        this.logger.debug(
          `Перекодированный: ${reencodedBase64.substring(0, 50)}...`,
        );
      }

      // Валидация размера файла
      const MIN_FILE_SIZE = 1024; // Минимум 1KB
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // Максимум 10MB

      if (buffer.length < MIN_FILE_SIZE) {
        this.logger.warn(
          `Изображение слишком маленькое: ${buffer.length} байт (минимум ${MIN_FILE_SIZE} байт)`,
        );
        return undefined;
      }

      if (buffer.length > MAX_FILE_SIZE) {
        this.logger.warn(
          `Изображение слишком большое: ${buffer.length} байт (максимум ${MAX_FILE_SIZE} байт)`,
        );
        return undefined;
      }

      // Улучшенная валидация JPEG
      const isValidJpeg = this.isValidJpeg(buffer);
      if (!isValidJpeg) {
        this.logger.error(
          `Изображение не прошло валидацию JPEG для номера ${plateNumber}`,
        );

        // Опционально: сохранять невалидные файлы ТОЛЬКО для диагностики (по умолчанию выключено)
        const DEBUG_SAVE_INVALID =
          (process.env.GATE_IMAGE_DEBUG_SAVE_INVALID || "").toLowerCase() ===
          "true";
        if (DEBUG_SAVE_INVALID) {
          try {
            const debugPath = path.join(
              datePath,
              `${imageType}_${plateNumber}_corrupted_${Date.now()}.jpg`,
            );
            fs.writeFileSync(debugPath, buffer);
            this.logger.warn(
              `🔧 DEBUG: невалидный файл сохранен для анализа: ${debugPath}`,
            );
          } catch (debugError) {
            this.logger.error(
              `Не удалось сохранить debug файл для номера ${plateNumber}: ${debugError.message}`,
            );
          }
        }

        // В проде не сохраняем невалидные изображения
        return undefined;
      }

      // Генерируем имя файла в зависимости от типа изображения
      const timestamp = Date.now();
      const prefix = imageType === "plate" ? "plate" : "car";
      const filename = `${prefix}_${plateNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.jpg`;
      const filePath = path.join(datePath, filename);

      // Сохраняем файл с обработкой ошибок
      try {
        fs.writeFileSync(filePath, buffer);

        // Возвращаем относительный путь
        const relativePath = path
          .join("uploads", "gate", dateDir, filename)
          .replace(/\\/g, "/");
        const validationStatus = isValidJpeg
          ? "валидное"
          : "невалидное (DEBUG MODE)";
        this.logger.log(
          `✅ ${imageType} изображение успешно сохранено: ${relativePath} (размер: ${buffer.length} байт, ${validationStatus})`,
        );

        return relativePath;
      } catch (writeError) {
        this.logger.error(
          `Ошибка записи файла ${filePath} для номера ${plateNumber}: ${writeError.message}`,
        );
        this.logger.error(`Проверьте права доступа к директории: ${datePath}`);
        return undefined;
      }
    } catch (error) {
      this.logger.error(
        `Ошибка сохранения изображения для номера ${plateNumber}: ${error.message}`,
        error.stack,
      );
      return undefined;
    }
  }

  /**
   * Проверяет валидность base64 строки
   */
  private isValidBase64(str: string): boolean {
    try {
      // Проверяем, что строка содержит только допустимые base64 символы
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }

      // Проверяем длину (должна быть кратна 4)
      if (str.length % 4 !== 0) {
        return false;
      }

      // Пробуем декодировать
      Buffer.from(str, "base64");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверяет валидность JPEG изображения
   */
  private isValidJpeg(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) {
      this.logger.warn(
        `JPEG валидация: buffer пустой или слишком маленький (${buffer?.length || 0} байт)`,
      );
      return false;
    }

    // Проверка начала JPEG файла (SOI - Start of Image)
    const hasJpegStart = buffer[0] === 0xff && buffer[1] === 0xd8;

    // Проверка конца JPEG файла (EOI - End of Image)
    const hasJpegEnd =
      buffer.length >= 2 &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9;

    // Проверка наличия валидных маркеров внутри файла (SOF0 или SOS)
    let hasValidMarkers = false;
    for (let i = 2; i < buffer.length - 2; i++) {
      if (
        buffer[i] === 0xff &&
        (buffer[i + 1] === 0xc0 || buffer[i + 1] === 0xda)
      ) {
        hasValidMarkers = true;
        break;
      }
    }

    // Проверка JFIF/EXIF маркера (опционально)
    let hasJfifMarker = false;
    for (let i = 2; i < Math.min(buffer.length - 2, 20); i++) {
      if (
        buffer[i] === 0xff &&
        (buffer[i + 1] === 0xe0 || buffer[i + 1] === 0xe1)
      ) {
        hasJfifMarker = true;
        break;
      }
    }

    // Делаем валидацию мягче: для боевой работы КПП достаточно корректного начала JPEG.
    // Многие камеры (в том числе Hikvision) добавляют служебные байты после EOI (FF D9),
    // поэтому требовать строго "последние 2 байта == FF D9" слишком жёстко.
    const isValid = hasJpegStart;

    // Улучшенное логирование для диагностики
    if (!isValid) {
      this.logger.warn(
        `❌ JPEG валидация НЕ ПРОЙДЕНА: start=${hasJpegStart}, end=${hasJpegEnd}, markers=${hasValidMarkers}, jfif=${hasJfifMarker}, size=${buffer.length}`,
      );

      // Логируем первые и последние байты для анализа
      const firstBytes = Array.from(
        buffer.slice(0, Math.min(10, buffer.length)),
      )
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      const lastBytes = Array.from(
        buffer.slice(Math.max(0, buffer.length - 10)),
      )
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      this.logger.warn(`   Первые байты: ${firstBytes}`);
      this.logger.warn(`   Последние байты: ${lastBytes}`);
    } else {
      this.logger.debug(
        `✅ JPEG валидация пройдена: start=${hasJpegStart}, end=${hasJpegEnd}, markers=${hasValidMarkers}, jfif=${hasJfifMarker}, size=${buffer.length}`,
      );
    }

    return isValid;
  }

  /**
   * Получить все события
   */
  async getAllEvents(filters?: {
    date?: string;
    dateStart?: string;
    dateEnd?: string;
    direction?: "income" | "outcome";
    plateNumber?: string;
  }): Promise<GateEvent[]> {
    this.logger.log(
      `Получение событий с фильтрами: ${JSON.stringify(filters)}`,
    );

    const where: any = {};

    if (filters?.date && filters.date.trim() !== "") {
      const selectedDate = new Date(filters.date);
      if (!isNaN(selectedDate.getTime())) {
        const startOfDay = selectedDate.getTime();
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
        where.eventTime = {
          [Op.between]: [startOfDay, endOfDay],
        };
        this.logger.log(
          `Фильтр по дате: ${filters.date} (${startOfDay} - ${endOfDay})`,
        );
      } else {
        this.logger.warn(`Неверный формат даты: ${filters.date}`);
      }
    } else if (filters?.dateStart && filters?.dateEnd) {
      // Убеждаемся, что значения не пустые строки
      const dateStartStr = String(filters.dateStart).trim();
      const dateEndStr = String(filters.dateEnd).trim();

      if (dateStartStr && dateEndStr) {
        const startTime = parseInt(dateStartStr, 10);
        const endTime = parseInt(dateEndStr, 10);

        this.logger.log(
          `Парсинг дат: dateStart="${dateStartStr}" -> ${startTime}, dateEnd="${dateEndStr}" -> ${endTime}`,
        );

        if (
          !isNaN(startTime) &&
          !isNaN(endTime) &&
          startTime > 0 &&
          endTime > 0
        ) {
          where.eventTime = {
            [Op.between]: [startTime, endTime],
          };
          this.logger.log(
            `Фильтр по диапазону дат установлен: ${startTime} - ${endTime}`,
          );
        } else {
          this.logger.warn(
            `Неверный формат диапазона дат: dateStart="${dateStartStr}" (${startTime}), dateEnd="${dateEndStr}" (${endTime})`,
          );
        }
      } else {
        this.logger.warn(
          `Пустые значения дат: dateStart="${dateStartStr}", dateEnd="${dateEndStr}"`,
        );
      }
    }

    if (filters?.direction) {
      where.eventType = filters.direction;
      this.logger.log(`Фильтр по направлению: ${filters.direction}`);
    }

    if (filters?.plateNumber) {
      where.plateNumber = {
        [Op.iLike]: `%${filters.plateNumber}%`,
      };
      this.logger.log(`Фильтр по номеру: ${filters.plateNumber}`);
    }

    // Улучшенное логирование WHERE условия (JSON.stringify не сериализует Symbol ключи)
    const whereForLog: any = {};
    if (where.eventTime && where.eventTime[Op.between]) {
      whereForLog.eventTime = `[Op.between: [${where.eventTime[Op.between][0]}, ${where.eventTime[Op.between][1]}]]`;
    }
    if (where.eventType) {
      whereForLog.eventType = where.eventType;
    }
    if (where.plateNumber) {
      whereForLog.plateNumber = where.plateNumber;
    }
    this.logger.log(`WHERE условие: ${JSON.stringify(whereForLog)}`);

    const result = await this.gateEventRepository.findAll({
      where,
      include: [
        { model: Reference, as: "carReference" },
        {
          model: Document,
          as: "leaveProdDocument",
          include: [
            {
              model: DocTableItems,
              include: [
                {
                  model: Reference,
                  as: "analiticReference",
                },
              ],
            },
          ],
        },
      ],
      order: [["eventTime", "DESC"]],
    });

    this.logger.log(`Найдено событий: ${result.length}`);
    return result;
  }

  /**
   * Получить события по номеру автомобиля
   */
  async getEventsByPlateNumber(plateNumber: string): Promise<GateEvent[]> {
    return this.gateEventRepository.findAll({
      where: { plateNumber },
      include: [
        { model: Reference, as: "carReference" },
        {
          model: Document,
          as: "leaveProdDocument",
          include: [
            {
              model: DocTableItems,
              include: [
                {
                  model: Reference,
                  as: "analiticReference",
                },
              ],
            },
          ],
        },
      ],
      order: [["eventTime", "DESC"]],
    });
  }

  /**
   * Отметить событие как обработанное
   */
  async markEventAsProcessed(eventId: number): Promise<void> {
    await this.gateEventRepository.update(
      { processed: true },
      { where: { id: eventId } },
    );
    this.logger.log(`Событие ${eventId} отмечено как обработанное`);
  }

  /**
   * Отправить команду на шлагбаум через WebSocket
   */
  private async sendGateCommand(gateEvent: GateEvent): Promise<void> {
    const gateClientEnabled =
      this.configService.get<string>("GATE_CLIENT_ENABLED") !== "false";
    if (!gateClientEnabled) {
      this.logger.debug(
        `[GATE] GATE_CLIENT_ENABLED=false — команда для события ${gateEvent.id} пропущена`,
      );
      return;
    }

    try {
      const gateId =
        this.configService.get<string>("GATE_ID") || "main-entrance";

      const command: {
        action: "open" | "close";
        gateId: string;
        eventId: number;
        carNumber: string;
        reason: "income" | "outcome_approved" | "outcome_denied";
      } = {
        action: gateEvent.gateAction === GateAction.OPENED ? "open" : "close",
        gateId,
        eventId: gateEvent.id,
        carNumber: gateEvent.plateNumber,
        reason:
          gateEvent.eventType === GateEventType.INCOME
            ? "income"
            : gateEvent.gateAction === GateAction.OPENED
              ? "outcome_approved"
              : "outcome_denied",
      };

      const success = await this.gateGateway.sendGateCommand(command);

      if (success) {
        this.logger.log(
          `Команда отправлена на шлагбаум ${gateId} для события ${gateEvent.id}`,
        );
      } else {
        this.logger.warn(
          `Не удалось отправить команду на шлагбаум ${gateId} для события ${gateEvent.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ошибка отправки команды на шлагбаум: ${error.message}`,
        error.stack,
      );
    }
  }
}
