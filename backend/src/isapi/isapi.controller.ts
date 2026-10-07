import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Headers,
} from "@nestjs/common";
import { Request } from "express";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { IsapiService } from "./isapi.service";
import * as multer from "multer";
import { ConfigService } from "@nestjs/config";

@ApiTags("ISAPI Events")
@Controller("isapi")
export class IsapiController {
  private readonly logger = new Logger(IsapiController.name);
  private upload = multer({ storage: multer.memoryStorage() });

  constructor(
    private isapiService: IsapiService,
    private configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: "Получение события от камеры Hikvision через ISAPI",
  })
  @ApiResponse({
    status: 200,
    description: "Событие успешно обработано",
  })
  @ApiResponse({
    status: 400,
    description: "Неверный формат XML",
  })
  @Post("event")
  async handleIsapiEvent(
    @Body() rawBody: Buffer,
    @Req() request: Request,
  ): Promise<string> {
    const cameraEnabled =
      this.configService.get<string>("CAMERA_ENABLED") !== "false";
    if (!cameraEnabled) {
      this.logger.debug(
        "[ISAPI] CAMERA_ENABLED=false — событие от камеры проигнорировано",
      );
      return "OK";
    }

    try {
      // Получаем IP адрес клиента
      const clientIp = this.getClientIp(request);
      this.logger.log(`Получено ISAPI событие от IP: ${clientIp}`);

      // Логируем заголовки запроса
      this.logger.debug(`Headers: ${JSON.stringify(request.headers)}`);
      this.logger.debug(`Content-Type: ${request.headers["content-type"]}`);

      // Логируем сырое тело запроса (ограничиваем размер для логов)
      this.logger.debug(`Raw body type: ${typeof rawBody}`);
      this.logger.debug(
        `Raw body length: ${rawBody ? rawBody.length : 0} bytes`,
      );
      const bodyPreview = rawBody
        ? rawBody.toString("hex").substring(0, 200) + "..."
        : "[empty]";
      this.logger.debug(`Raw body preview (hex): ${bodyPreview}`);

      // Обработка различных типов body
      let xmlString = "";
      let detectionImageBase64: string | undefined;
      let plateImageBase64: string | undefined;

      // Проверяем, это multipart/form-data
      const contentType = request.headers["content-type"] || "";
      if (contentType.includes("multipart/form-data")) {
        this.logger.debug("Обработка multipart/form-data запроса");

        // Парсим multipart данные из Buffer
        const multipartResult = this.parseMultipartData(rawBody, contentType);
        xmlString = multipartResult.xml;
        detectionImageBase64 = multipartResult.detectionImageBase64;
        plateImageBase64 = multipartResult.plateImageBase64;

        this.logger.log(
          `Multipart парсинг: XML=${xmlString.length} символов, DetectionImage=${detectionImageBase64 ? "найдено" : "не найдено"}, PlateImage=${plateImageBase64 ? "найдено" : "не найдено"}`,
        );

        // Если XML не извлечен, используем исходные данные
        if (!xmlString || xmlString.trim() === "") {
          this.logger.warn(
            "Не удалось извлечь XML из multipart, используем исходные данные",
          );
          xmlString = rawBody.toString("utf8");
        }
      } else {
        // Для не-multipart запросов конвертируем Buffer в строку
        xmlString = rawBody.toString("utf8");
      }

      this.logger.debug(
        `Processed XML string: ${xmlString.substring(0, 200)}${xmlString.length > 200 ? "..." : ""}`,
      );

      // Обработка пустых или регистрационных запросов
      if (!xmlString || xmlString.trim().length === 0) {
        this.logger.log(
          `Регистрационный запрос от IP: ${clientIp} (пустой body) - возвращаем OK`,
        );
        return "OK";
      }

      // Проверка что это XML (более мягкая)
      if (
        !xmlString.trim().startsWith("<?xml") &&
        !xmlString.trim().startsWith("<")
      ) {
        this.logger.log(
          `Регистрационный запрос от IP: ${clientIp} (не XML) - возвращаем OK`,
        );
        return "OK";
      }

      // Обработка события
      await this.isapiService.processIsapiEvent(
        xmlString,
        clientIp,
        detectionImageBase64,
        plateImageBase64,
      );

      // Камера ожидает HTTP 200 OK
      return "OK";
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Ошибка обработки ISAPI события: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Ошибка обработки события от камеры",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: "Статус ISAPI сервиса" })
  @ApiResponse({
    status: 200,
    description: "Статус сервиса",
    schema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        eventsProcessed: { type: "number" },
        lastEvent: { type: "string", format: "date-time" },
        uptime: { type: "number" },
      },
    },
  })
  @Get("status")
  async getStatus(): Promise<object> {
    this.logger.log("GET /isapi/status - запрос статуса ISAPI сервиса");
    return this.isapiService.getStatus();
  }

  /**
   * Парсит multipart/form-data и извлекает XML и изображения
   */
  private parseMultipartData(
    multipartBuffer: Buffer,
    contentType: string,
  ): {
    xml: string;
    detectionImageBase64?: string;
    plateImageBase64?: string;
  } {
    try {
      this.logger.debug("Начинаем парсинг multipart данных из Buffer");

      // Извлекаем boundary из Content-Type
      const boundaryMatch = contentType.match(/boundary=([^;]+)/);
      if (!boundaryMatch) {
        this.logger.warn("Не удалось найти boundary в Content-Type");
        return { xml: multipartBuffer.toString("utf8") };
      }

      const boundary = `--${boundaryMatch[1]}`;
      this.logger.debug(`Boundary: ${boundary}`);

      // Конвертируем boundary в Buffer для поиска
      const boundaryBuffer = Buffer.from(boundary, "utf8");

      // Разделяем на части используя Buffer.indexOf
      const parts: Buffer[] = [];
      let start = 0;
      let boundaryIndex = multipartBuffer.indexOf(boundaryBuffer, start);

      while (boundaryIndex !== -1) {
        if (start < boundaryIndex) {
          parts.push(multipartBuffer.slice(start, boundaryIndex));
        }
        start = boundaryIndex + boundaryBuffer.length;
        boundaryIndex = multipartBuffer.indexOf(boundaryBuffer, start);
      }

      // Добавляем последнюю часть
      if (start < multipartBuffer.length) {
        parts.push(multipartBuffer.slice(start));
      }

      this.logger.debug(`Найдено ${parts.length} частей в multipart`);
      this.logger.debug(
        `Общий размер multipart данных: ${multipartBuffer.length} байт`,
      );

      let xmlContent = "";
      let detectionImageBuffer: Buffer | undefined;
      let plateImageBuffer: Buffer | undefined;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part || part.length === 0) continue;

        this.logger.debug(`Обработка части ${i}: ${part.length} байт`);

        // Ищем заголовки части (ищем \r\n\r\n)
        const headerEndBuffer = Buffer.from("\r\n\r\n", "utf8");
        const headerEndIndex = part.indexOf(headerEndBuffer);
        if (headerEndIndex === -1) {
          this.logger.warn(
            `⚠️ Часть ${i}: не найдены заголовки (\\r\\n\\r\\n)`,
          );
          this.logger.debug(
            `Первые 100 байт части ${i}: ${part.slice(0, 100).toString("hex")}`,
          );
          continue;
        }

        const headersBuffer = part.slice(0, headerEndIndex);
        let contentBuffer = part.slice(headerEndIndex + headerEndBuffer.length);

        const headers = headersBuffer.toString("utf8");

        // Для изображений нужно обрезать лишние данные в конце
        if (headers.includes("Content-Type: image/")) {
          // Ищем следующий boundary или конец данных
          const nextBoundaryIndex = contentBuffer.indexOf(boundaryBuffer);
          if (nextBoundaryIndex !== -1) {
            contentBuffer = contentBuffer.slice(0, nextBoundaryIndex);
          }

          // Убираем trailing \r\n если есть
          if (
            contentBuffer.length >= 2 &&
            contentBuffer[contentBuffer.length - 2] === 0x0d &&
            contentBuffer[contentBuffer.length - 1] === 0x0a
          ) {
            contentBuffer = contentBuffer.slice(0, -2);
          }
        }
        this.logger.debug(`Заголовки части ${i}: ${headers}`);

        // Проверяем, это XML или изображение
        if (
          headers.includes("Content-Type: text/xml") ||
          headers.includes("Content-Type: application/xml")
        ) {
          this.logger.debug(`Найдена XML часть в части ${i}`);
          xmlContent = contentBuffer.toString("utf8").trim();
        } else if (
          headers.includes("Content-Type: image/") ||
          headers.includes("Content-Type: application/octet-stream")
        ) {
          this.logger.debug(`Найдена изображение в части ${i}`);

          // Определяем тип изображения по имени поля
          let imageType = "unknown";
          if (
            headers.includes('name="detectionPicture"') ||
            headers.includes('name="detectionPicture.jpg"')
          ) {
            imageType = "detection";
          } else if (
            headers.includes('name="licensePlatePicture"') ||
            headers.includes('name="licensePlatePicture.jpg"') ||
            headers.includes('name="licensePlatePicture_1.jpg"')
          ) {
            imageType = "plate";
          } else if (
            headers.includes('name="plateBinaryPicture"') ||
            headers.includes('name="plateBinaryPicture.jpg"')
          ) {
            imageType = "plateBinary";
          }

          this.logger.debug(`Тип изображения: ${imageType}`);

          // Дополнительное логирование для отладки
          this.logger.debug(
            `📸 ${imageType} изображение: размер ${contentBuffer.length} байт`,
          );
          this.logger.debug(
            `📸 Первые 20 байт (hex): ${contentBuffer.slice(0, 20).toString("hex")}`,
          );
          this.logger.debug(
            `📸 Последние 10 байт (hex): ${contentBuffer.slice(-10).toString("hex")}`,
          );

          // Проверяем валидность JPEG
          if (this.isValidJpeg(contentBuffer)) {
            this.logger.log(
              `📸 ${imageType} изображение извлечено и валидировано: ${contentBuffer.length} байт`,
            );

            // Сохраняем изображения по типу
            if (imageType === "detection") {
              detectionImageBuffer = contentBuffer;
            } else if (imageType === "plate" || imageType === "plateBinary") {
              // Приоритет: licensePlatePicture > plateBinaryPicture
              if (!plateImageBuffer || imageType === "plate") {
                plateImageBuffer = contentBuffer;
              }
            }
          } else {
            this.logger.warn(
              `⚠️ ${imageType} изображение не прошло валидацию JPEG, но сохраняем его`,
            );
            // Сохраняем изображение даже если валидация не прошла
            if (imageType === "detection") {
              detectionImageBuffer = contentBuffer;
            } else if (imageType === "plate" || imageType === "plateBinary") {
              if (!plateImageBuffer || imageType === "plate") {
                plateImageBuffer = contentBuffer;
              }
            }
          }
        }
      }

      // Конвертируем изображения в base64 если найдены
      let detectionImageBase64: string | undefined;
      let plateImageBase64: string | undefined;

      if (detectionImageBuffer) {
        detectionImageBase64 = `data:image/jpeg;base64,${detectionImageBuffer.toString("base64")}`;
        this.logger.log(
          `📸 Detection изображение конвертировано в base64: ${detectionImageBase64.length} символов`,
        );
      } else {
        this.logger.warn(
          `⚠️ Detection изображение не найдено в multipart данных`,
        );
        // Попробуем найти любое изображение как fallback
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part || part.length === 0) continue;

          const headerEndBuffer = Buffer.from("\r\n\r\n", "utf8");
          const headerEndIndex = part.indexOf(headerEndBuffer);
          if (headerEndIndex === -1) continue;

          const headers = part.slice(0, headerEndIndex).toString("utf8");
          if (headers.includes("Content-Type: image/")) {
            const contentBuffer = part.slice(
              headerEndIndex + headerEndBuffer.length,
            );
            this.logger.warn(
              `🔄 Fallback: используем изображение из части ${i} как detection`,
            );
            detectionImageBuffer = contentBuffer;
            break;
          }
        }
      }

      if (plateImageBuffer) {
        plateImageBase64 = `data:image/jpeg;base64,${plateImageBuffer.toString("base64")}`;
        this.logger.log(
          `📸 Plate изображение конвертировано в base64: ${plateImageBase64.length} символов`,
        );
      } else {
        this.logger.warn(`⚠️ Plate изображение не найдено в multipart данных`);
      }

      // Если detection изображение найдено через fallback, конвертируем его
      if (detectionImageBuffer && !detectionImageBase64) {
        detectionImageBase64 = `data:image/jpeg;base64,${detectionImageBuffer.toString("base64")}`;
        this.logger.log(
          `📸 Detection изображение (fallback) конвертировано в base64: ${detectionImageBase64.length} символов`,
        );
      }

      return { xml: xmlContent, detectionImageBase64, plateImageBase64 };
    } catch (error) {
      this.logger.error(`Ошибка парсинга multipart: ${error.message}`);
      return { xml: multipartBuffer.toString("utf8") };
    }
  }

  /**
   * Проверяет валидность JPEG изображения с улучшенной валидацией
   */
  private isValidJpeg(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) {
      this.logger.debug(
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

    // Временно делаем валидацию менее строгой для отладки
    const isValid = hasJpegStart && hasJpegEnd; // Убираем проверку маркеров временно

    this.logger.debug(
      `JPEG валидация: start=${hasJpegStart}, end=${hasJpegEnd}, markers=${hasValidMarkers}, jfif=${hasJfifMarker}, valid=${isValid}, size=${buffer.length}`,
    );

    return isValid;
  }

  /**
   * Извлекает XML из multipart/form-data (старый метод для совместимости)
   */
  private extractXmlFromMultipart(multipartData: string): string {
    try {
      this.logger.debug("Начинаем извлечение XML из multipart данных");

      // Простой поиск XML блока
      const xmlStart = multipartData.indexOf("<?xml");
      if (xmlStart === -1) {
        this.logger.warn("XML не найден в multipart данных");
        return "";
      }

      const xmlEnd = multipartData.indexOf(
        "</EventNotificationAlert>",
        xmlStart,
      );
      if (xmlEnd === -1) {
        this.logger.warn("Закрывающий тег EventNotificationAlert не найден");
        return "";
      }

      const xmlContent = multipartData.substring(
        xmlStart,
        xmlEnd + "</EventNotificationAlert>".length,
      );

      if (xmlContent && xmlContent.trim().startsWith("<?xml")) {
        this.logger.debug("XML успешно извлечен из multipart данных");
        return xmlContent;
      }

      this.logger.warn("Извлеченный XML невалиден");
      return "";
    } catch (error) {
      this.logger.error(`Ошибка извлечения XML из multipart: ${error.message}`);
      return "";
    }
  }

  /**
   * Получает IP адрес клиента из заголовков запроса
   * Учитывает заголовки от Nginx: X-Forwarded-For, X-Real-IP
   */
  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers["x-forwarded-for"] as string;
    const xRealIp = request.headers["x-real-ip"] as string;
    const remoteAddress = request.connection?.remoteAddress;

    // X-Forwarded-For может содержать несколько IP через запятую (первый - оригинальный клиент)
    if (xForwardedFor) {
      return xForwardedFor.split(",")[0].trim();
    }

    if (xRealIp) {
      return xRealIp;
    }

    if (remoteAddress) {
      // Убираем IPv6 префикс если есть
      return remoteAddress.replace("::ffff:", "");
    }

    return "unknown";
  }
}
