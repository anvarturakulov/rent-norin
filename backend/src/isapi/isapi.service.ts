import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GateEventsService } from "../gateEvents/gateEvents.service";
import { CameraEventDto } from "../gateEvents/dto/camera-event.dto";
import { GateEventType } from "../gateEvents/gateEvent.model";
import { IsapiEventDto, IsapiAnprDto } from "./dto/isapi-event.dto";
import * as xml2js from "xml2js";
import * as fs from "fs";
import * as path from "path";
import * as moment from "moment-timezone";

@Injectable()
export class IsapiService {
  private readonly logger = new Logger(IsapiService.name);
  private eventCounter = 0;
  private lastEventTime: Date | null = null;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => GateEventsService))
    private gateEventsService: GateEventsService,
  ) {
    this.logger.log(`ISAPI Service initialized`);
  }

  /**
   * Проверка HTTP Basic Authentication
   */
  validateBasicAuth(authHeader: string): boolean {
    if (!authHeader?.startsWith("Basic ")) {
      return false;
    }

    const base64Credentials = authHeader.substring(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf8",
    );
    const [username, password] = credentials.split(":");

    const expectedUsername = this.configService.get("ISAPI_USERNAME");
    const expectedPassword = this.configService.get("ISAPI_PASSWORD");

    return username === expectedUsername && password === expectedPassword;
  }

  /**
   * Обработка ISAPI события
   */
  async processIsapiEvent(
    xml: string,
    httpClientIp: string,
    detectionImageBase64?: string,
    plateImageBase64?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Обработка ISAPI события от HTTP клиента: ${httpClientIp}`,
      );

      // Проверяем, есть ли XML для парсинга
      if (!xml || xml.trim().length === 0) {
        this.logger.log(
          `Регистрационный запрос от HTTP клиента ${httpClientIp} (пустой XML) - возвращаем OK`,
        );
        return { message: "Camera registered successfully", status: "online" };
      }

      // Парсинг XML
      const parsed = await this.parseXml(xml);

      // Проверяем, есть ли EventNotificationAlert
      if (!parsed.EventNotificationAlert) {
        this.logger.log(
          `Регистрационный запрос от HTTP клиента ${httpClientIp} (без EventNotificationAlert) - возвращаем OK`,
        );
        return { message: "Camera registered successfully", status: "online" };
      }

      // Извлечение данных события
      const eventData = this.extractEventData(parsed);

      // Берем IP камеры из XML (если есть), но можем потребовать, чтобы он был в конфиге (защита от подделки событий)
      const cameraIpFromXml =
        eventData.ipAddress && eventData.ipAddress !== "unknown"
          ? eventData.ipAddress
          : undefined;

      const requireKnownCameraIp =
        (
          this.configService.get<string>("ISAPI_REQUIRE_KNOWN_CAMERA_IP") ||
          "true"
        ).toLowerCase() === "true";
      const knownCameraIps = [
        ...this.configService
          .get<string>("INCOME_CAMERA_IPS", "")
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean),
        ...this.configService
          .get<string>("OUTCOME_CAMERA_IPS", "")
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean),
      ];

      if (requireKnownCameraIp) {
        if (!cameraIpFromXml) {
          this.logger.warn(
            `ISAPI событие без ipAddress в XML отклонено (requireKnownCameraIp=true). HTTP клиент: ${httpClientIp}`,
          );
          return { message: "Camera IP not provided", status: "ignored" };
        }
        if (!knownCameraIps.includes(cameraIpFromXml)) {
          this.logger.warn(
            `ISAPI событие с неизвестным IP в XML отклонено: ${cameraIpFromXml}. HTTP клиент: ${httpClientIp}`,
          );
          return { message: "Unknown camera IP", status: "ignored" };
        }
      }

      const cameraIp = cameraIpFromXml || httpClientIp;

      this.logger.log(
        `IP камеры из XML: ${eventData.ipAddress}, HTTP клиент: ${httpClientIp}, используем: ${cameraIp}`,
      );
      this.logger.log(
        `Направление из XML: "${eventData.direction}", номер: ${eventData.licensePlate}`,
      );

      // Логируем источник изображений
      if (detectionImageBase64) {
        this.logger.log(
          `📸 Detection изображение получено из multipart: ${detectionImageBase64.length} символов base64`,
        );
      } else if (eventData.imageData) {
        this.logger.log(
          `📸 Detection изображение получено из XML: ${eventData.imageData.length} символов`,
        );
      } else {
        this.logger.log(
          `📸 Detection изображение не найдено ни в multipart, ни в XML`,
        );
      }

      if (plateImageBase64) {
        this.logger.log(
          `📸 Plate изображение получено из multipart: ${plateImageBase64.length} символов base64`,
        );
      } else {
        this.logger.log(`📸 Plate изображение не найдено в multipart`);
      }

      // Преобразование в CameraEventDto с IP из XML
      const cameraEvent = this.mapToCameraEvent(
        eventData,
        cameraIp,
        detectionImageBase64,
        plateImageBase64,
      );

      // Вызов существующего сервиса обработки событий
      const result =
        await this.gateEventsService.processCameraEvent(cameraEvent);

      // Обновление статистики
      this.eventCounter++;
      this.lastEventTime = new Date();

      this.logger.log(
        `ISAPI событие обработано: ${cameraEvent.plateNumber} (${cameraEvent.eventType}) от камеры ${cameraIpFromXml}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Ошибка обработки ISAPI события: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Парсинг XML в объект JavaScript
   */
  private async parseXml(xml: string): Promise<any> {
    try {
      const parser = new xml2js.Parser({
        explicitArray: true,
        mergeAttrs: true,
        trim: true,
      });

      const result = await parser.parseStringPromise(xml);
      return result;
    } catch (error) {
      this.logger.warn(
        `Ошибка парсинга XML: ${error.message} - возвращаем пустой объект`,
      );
      // Возвращаем пустой объект вместо ошибки для регистрационных запросов
      return {};
    }
  }

  /**
   * Извлечение данных события из распарсенного XML
   */
  private extractEventData(parsed: any): IsapiEventDto {
    try {
      const alert = parsed.EventNotificationAlert;

      if (!alert) {
        throw new Error("EventNotificationAlert not found in XML");
      }

      let anpr = alert.ANPRInfo?.[0];
      if (!anpr) {
        // Попробуем найти ANPR данные в других возможных местах
        const possibleAnprFields = [
          "ANPR",
          "AnprInfo",
          "anpr",
          "anprInfo",
          "ANPRData",
        ];
        let foundAnpr = null;

        for (const field of possibleAnprFields) {
          if (alert[field]?.[0]) {
            foundAnpr = alert[field][0];
            break;
          }
        }

        if (!foundAnpr) {
          this.logger.error(
            "ANPR данные не найдены ни в одном из возможных полей",
          );
          this.logger.error("Доступные поля в alert:", Object.keys(alert));
          throw new Error("ANPR data not found in XML");
        }

        // Используем найденные данные
        anpr = foundAnpr;
      }

      const eventData: IsapiEventDto = {
        ipAddress: alert.ipAddress?.[0] || "unknown",
        dateTime: alert.dateTime?.[0] || new Date().toISOString(),
        eventType: alert.eventType?.[0] || "ANPR",
        licensePlate:
          anpr.licensePlate?.[0] || anpr.originalLicensePlate?.[0] || "",
        country: anpr.country?.[0],
        vehicleColor: anpr.vehicleColor?.[0],
        vehicleType: anpr.vehicleType?.[0],
        direction: anpr.direction?.[0] || "entrance",
        confidenceLevel: anpr.confidenceLevel?.[0]
          ? parseInt(anpr.confidenceLevel[0])
          : undefined,
        laneNo: anpr.line?.[0] ? parseInt(anpr.line[0]) : undefined,
        picName: anpr.picName?.[0],
        imageData:
          anpr.imageData?.[0] || anpr.picData?.[0] || anpr.binaryData?.[0],
      };

      return eventData;
    } catch (error) {
      this.logger.error(`Ошибка извлечения данных события: ${error.message}`);
      throw error;
    }
  }

  /**
   * Парсинг даты без конвертации часового пояса
   * Сохраняем время как есть от камеры
   */
  private parseDateTime(dateTimeString: string): number {
    try {
      this.logger.debug(`Парсинг времени от камеры: ${dateTimeString}`);

      // Просто парсим время как есть, без конвертации часового пояса
      const momentDate = moment(dateTimeString);

      this.logger.log(
        `🌍 Время от камеры: ${dateTimeString} → ${momentDate.toISOString()} (timestamp: ${momentDate.valueOf()})`,
      );

      // Проверяем, что дата валидна
      if (!momentDate.isValid()) {
        this.logger.warn(
          `Неверный формат даты: ${dateTimeString}, используем текущее время`,
        );
        return Date.now();
      }

      return momentDate.valueOf();
    } catch (error) {
      this.logger.error(
        `Ошибка парсинга даты: ${dateTimeString}, используем текущее время`,
        error,
      );
      return Date.now();
    }
  }

  /**
   * Преобразование ISAPI события в CameraEventDto
   */
  private mapToCameraEvent(
    eventData: IsapiEventDto,
    cameraIp: string,
    detectionImageBase64?: string,
    plateImageBase64?: string,
  ): CameraEventDto {
    // Используем переданный IP (уже из XML) для определения направления
    const cameraEvent = {
      plateNumber: eventData.licensePlate,
      eventType: this.mapDirection(
        eventData.direction,
        cameraIp,
        eventData.laneNo,
      ),
      timestamp: this.parseDateTime(eventData.dateTime),
      cameraIp: cameraIp, // Используем IP из XML
      vehicleType: eventData.vehicleType || "car",
      vehicleColor: eventData.vehicleColor || "unknown",
      // Приоритет: multipart detection изображение > XML изображение
      imageBase64:
        detectionImageBase64 ||
        (eventData.imageData
          ? `data:image/jpeg;base64,${eventData.imageData}`
          : undefined),
      // Plate изображение только из multipart
      plateImageBase64: plateImageBase64,
    };

    // Логируем финальные данные для отладки
    this.logger.log(`📊 Создание CameraEventDto:`);
    this.logger.log(`   Номер: ${cameraEvent.plateNumber}`);
    this.logger.log(`   Тип события: ${cameraEvent.eventType}`);
    this.logger.log(`   Timestamp: ${cameraEvent.timestamp}`);
    this.logger.log(`   IP камеры: ${cameraEvent.cameraIp}`);
    this.logger.log(`   Тип ТС: ${cameraEvent.vehicleType}`);
    this.logger.log(`   Цвет: ${cameraEvent.vehicleColor}`);
    this.logger.log(
      `   Detection изображение: ${cameraEvent.imageBase64 ? "есть" : "нет"}`,
    );
    this.logger.log(
      `   Plate изображение: ${cameraEvent.plateImageBase64 ? "есть" : "нет"}`,
    );

    // Конвертируем timestamp в читаемый формат для отладки
    const timestampDate = new Date(cameraEvent.timestamp);
    this.logger.log(`   Время события: ${timestampDate.toISOString()}`);

    if (cameraEvent.imageBase64) {
      this.logger.log(
        `📸 Detection изображение получено от камеры ${cameraEvent.cameraIp} для номера ${cameraEvent.plateNumber}`,
      );
    }

    if (cameraEvent.plateImageBase64) {
      this.logger.log(
        `📸 Plate изображение получено от камеры ${cameraEvent.cameraIp} для номера ${cameraEvent.plateNumber}`,
      );
    }

    return cameraEvent;
  }

  /**
   * Маппинг направления движения
   * Основной метод - определение по IP камеры
   */
  private mapDirection(
    direction: string,
    cameraIp?: string,
    laneNo?: number,
  ): GateEventType {
    this.logger.debug(
      `Определение направления: direction="${direction}", cameraIp="${cameraIp}", laneNo=${laneNo}`,
    );

    // ОСНОВНОЙ МЕТОД: Определение по IP камеры
    if (cameraIp) {
      const directionByIp = this.determineDirectionByCameraIp(cameraIp);
      if (directionByIp) {
        this.logger.log(
          `✅ Направление определено по IP камеры ${cameraIp}: ${directionByIp}`,
        );
        return directionByIp;
      }
    }

    // ДОПОЛНИТЕЛЬНЫЙ МЕТОД: По номеру полосы (если есть)
    if (laneNo !== undefined) {
      const isIncome = laneNo % 2 === 0;
      this.logger.debug(
        `Направление определено по номеру полосы ${laneNo}: ${isIncome ? "въезд" : "выезд"}`,
      );
      return isIncome ? GateEventType.INCOME : GateEventType.OUTCOME;
    }

    // ДОПОЛНИТЕЛЬНЫЙ МЕТОД: По значению direction из XML
    if (direction && direction.trim() !== "") {
      const normalized = direction.toLowerCase().trim();

      // Прямые совпадения для въезда
      if (
        normalized.includes("entrance") ||
        normalized.includes("in") ||
        normalized.includes("income") ||
        normalized.includes("въезд") ||
        normalized === "0" ||
        normalized === "inbound" ||
        normalized === "forward" ||
        normalized === "1"
      ) {
        this.logger.debug(
          `Направление определено как въезд по значению: ${direction}`,
        );
        return GateEventType.INCOME;
      }

      // Прямые совпадения для выезда
      if (
        normalized.includes("exit") ||
        normalized.includes("out") ||
        normalized.includes("outcome") ||
        normalized.includes("выезд") ||
        normalized === "1" ||
        normalized === "outbound" ||
        normalized === "backward"
      ) {
        this.logger.debug(
          `Направление определено как выезд по значению: ${direction}`,
        );
        return GateEventType.OUTCOME;
      }
    }

    // По умолчанию считаем въездом (более безопасно для производства)
    this.logger.warn("Не удалось определить направление, считаем въездом");
    return GateEventType.INCOME;
  }

  /**
   * Определение направления по IP камеры
   * Можно настроить разные IP для въезда/выезда
   */
  private determineDirectionByCameraIp(cameraIp: string): GateEventType | null {
    // Настройки IP камер для въезда/выезда (можно вынести в конфиг)
    const incomeCameraIps = this.configService
      .get<string>("INCOME_CAMERA_IPS", "")
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip);
    const outcomeCameraIps = this.configService
      .get<string>("OUTCOME_CAMERA_IPS", "")
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip);

    this.logger.debug(`=== ОПРЕДЕЛЕНИЕ НАПРАВЛЕНИЯ ПО IP ===`);
    this.logger.debug(`IP камеры: ${cameraIp}`);
    this.logger.debug(`IP для въезда: [${incomeCameraIps.join(", ")}]`);
    this.logger.debug(`IP для выезда: [${outcomeCameraIps.join(", ")}]`);
    this.logger.debug(`Проверка въезда: ${incomeCameraIps.includes(cameraIp)}`);
    this.logger.debug(
      `Проверка выезда: ${outcomeCameraIps.includes(cameraIp)}`,
    );

    if (incomeCameraIps.includes(cameraIp)) {
      this.logger.log(`✅ IP ${cameraIp} найден в списке камер для ВЪЕЗДА`);
      return GateEventType.INCOME;
    }

    if (outcomeCameraIps.includes(cameraIp)) {
      this.logger.log(`✅ IP ${cameraIp} найден в списке камер для ВЫЕЗДА`);
      return GateEventType.OUTCOME;
    }

    this.logger.warn(
      `❌ IP ${cameraIp} НЕ найден в списках камер - будет определен как въезд по умолчанию`,
    );
    return null;
  }

  /**
   * Сохранение изображения от камеры
   */
  async saveImage(
    imageBuffer: Buffer,
    cameraIp: string,
    plateNumber?: string,
  ): Promise<string> {
    try {
      this.logger.log(
        `Начинаем сохранение изображения от камеры ${cameraIp} для номера ${plateNumber || "unknown"}`,
      );

      // Валидация размера файла
      const MIN_FILE_SIZE = 1024; // Минимум 1KB
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // Максимум 10MB

      if (imageBuffer.length < MIN_FILE_SIZE) {
        this.logger.warn(
          `Изображение слишком маленькое: ${imageBuffer.length} байт (минимум ${MIN_FILE_SIZE} байт)`,
        );
        throw new Error(
          `Изображение слишком маленькое: ${imageBuffer.length} байт`,
        );
      }

      if (imageBuffer.length > MAX_FILE_SIZE) {
        this.logger.warn(
          `Изображение слишком большое: ${imageBuffer.length} байт (максимум ${MAX_FILE_SIZE} байт)`,
        );
        throw new Error(
          `Изображение слишком большое: ${imageBuffer.length} байт`,
        );
      }

      // Проверяем валидность JPEG
      if (!this.isValidJpeg(imageBuffer)) {
        this.logger.error(
          `Изображение не прошло валидацию JPEG от камеры ${cameraIp}`,
        );
        throw new Error(`Изображение не прошло валидацию JPEG`);
      }

      // Создаем директорию для изображений
      const uploadsDir = path.join(process.cwd(), "uploads", "gate");
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const dateDir = path.join(uploadsDir, today);

      if (!fs.existsSync(dateDir)) {
        fs.mkdirSync(dateDir, { recursive: true });
      }

      // Генерируем имя файла
      const timestamp = Date.now();
      const filename = plateNumber
        ? `car_${plateNumber}_${timestamp}.jpg`
        : `car_${cameraIp}_${timestamp}.jpg`;

      const filePath = path.join(dateDir, filename);

      // Сохраняем файл
      fs.writeFileSync(filePath, imageBuffer);

      // Возвращаем относительный путь для базы данных
      const relativePath = path
        .join("uploads", "gate", today, filename)
        .replace(/\\/g, "/");

      this.logger.log(
        `✅ Изображение успешно сохранено: ${relativePath} (размер: ${imageBuffer.length} байт)`,
      );
      return relativePath;
    } catch (error) {
      this.logger.error(
        `Ошибка сохранения изображения от камеры ${cameraIp}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Проверяет валидность JPEG изображения
   */
  private isValidJpeg(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    // JPEG начинается с FF D8 (SOI - Start of Image)
    const hasJpegStart = buffer[0] === 0xff && buffer[1] === 0xd8;

    // JPEG заканчивается FF D9 (EOI - End of Image)
    const hasJpegEnd =
      buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;

    // Дополнительная проверка: ищем JFIF или EXIF маркеры (необязательно)
    const hasJfifMarker =
      buffer.length > 7 && buffer.toString("ascii", 2, 7) === "JFIF\0";
    const hasExifMarker =
      buffer.length > 6 && buffer.toString("ascii", 2, 6) === "Exif\0";

    // JPEG валиден если есть правильные начало и конец
    const isValid = hasJpegStart && hasJpegEnd;

    this.logger.debug(
      `JPEG валидация: start=${hasJpegStart}, end=${hasJpegEnd}, jfif=${hasJfifMarker}, exif=${hasExifMarker}, valid=${isValid}`,
    );

    return isValid;
  }

  /**
   * Получение статистики ISAPI сервиса
   */
  getStatus(): object {
    return {
      enabled: true,
      eventsProcessed: this.eventCounter,
      lastEvent: this.lastEventTime,
      uptime: process.uptime(),
    };
  }
}
