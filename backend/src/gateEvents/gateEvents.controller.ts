import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Query,
  Req,
  Res,
  ParseIntPipe,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { GateEventsService } from "./gateEvents.service";
import { CameraEventDto } from "./dto/camera-event.dto";
import { GateEvent } from "./gateEvent.model";
import { GateGateway } from "./gate-gateway";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles-auth.decorator";
import { UserRoles } from "../interfaces/user.interface";
import { GateExportService } from "./gateExport.service";

@ApiTags("Gate Events")
@Controller("gate-events")
export class GateEventsController {
  private readonly logger = new Logger(GateEventsController.name);

  // IP проверка отключена - используется только API Key аутентификация

  constructor(
    private gateEventsService: GateEventsService,
    private configService: ConfigService,
    private gateGateway: GateGateway,
    private gateExportService: GateExportService,
  ) {}

  @ApiOperation({ summary: "Получение события от IP-камеры" })
  @ApiResponse({
    status: 201,
    description: "Событие успешно обработано",
    type: GateEvent,
  })
  @ApiResponse({
    status: 401,
    description: "Неверный API ключ",
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные запроса",
  })
  @ApiHeader({
    name: "X-Camera-Api-Key",
    description: "API ключ для аутентификации камеры",
    required: true,
  })
  @Post("camera-event")
  async processCameraEvent(
    @Body() cameraEventDto: CameraEventDto,
    @Headers("x-camera-api-key") apiKey: string,
    @Req() request: Request,
  ): Promise<GateEvent> {
    const cameraEnabled =
      this.configService.get<string>("CAMERA_ENABLED") !== "false";
    if (!cameraEnabled) {
      this.logger.debug(
        "[CAMERA] CAMERA_ENABLED=false — запрос /camera-event проигнорирован",
      );
      throw new HttpException(
        "Camera integration is disabled",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Получаем IP адрес клиента из заголовков (от Nginx)
    const clientIp = this.getClientIp(request);
    this.logger.log(
      `Получено событие от камеры: ${cameraEventDto.plateNumber}, IP: ${clientIp}`,
    );

    // IP проверка отключена - используется только API Key аутентификация

    // Проверка API ключа
    const validApiKey = this.configService.get<string>("GATE_API_KEY");
    if (!apiKey || apiKey !== validApiKey) {
      this.logger.warn(`Неверный API ключ от IP: ${clientIp}`);
      throw new HttpException("Неверный API ключ", HttpStatus.UNAUTHORIZED);
    }

    try {
      const gateEvent =
        await this.gateEventsService.processCameraEvent(cameraEventDto);

      this.logger.log(
        `Событие обработано: ID=${gateEvent.id}, действие=${gateEvent.gateAction}`,
      );

      return gateEvent;
    } catch (error) {
      this.logger.error(
        `Ошибка обработки события от камеры: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Ошибка обработки события от камеры",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: "Получение всех событий КПП" })
  @ApiResponse({
    status: 200,
    description: "Список всех событий",
    type: [GateEvent],
  })
  @Get()
  async getAllEvents(
    @Query("date") date?: string,
    @Query("dateStart") dateStart?: string,
    @Query("dateEnd") dateEnd?: string,
    @Query("direction") direction?: "income" | "outcome",
    @Query("plateNumber") plateNumber?: string,
  ): Promise<GateEvent[]> {
    this.logger.log(
      `GET /gate-events запрос с параметрами: date=${date}, dateStart=${dateStart}, dateEnd=${dateEnd}, direction=${direction}, plateNumber=${plateNumber}`,
    );
    this.logger.log(
      `Типы параметров: dateStart type=${typeof dateStart}, value="${dateStart}", dateEnd type=${typeof dateEnd}, value="${dateEnd}"`,
    );
    const result = await this.gateEventsService.getAllEvents({
      date,
      dateStart,
      dateEnd,
      direction,
      plateNumber,
    });
    this.logger.log(`GET /gate-events возвращает ${result.length} событий`);
    return result;
  }

  @Get("test")
  async testEndpoint(): Promise<{ message: string; timestamp: number }> {
    this.logger.log("GET /gate-events/test - тестовый endpoint вызван");
    return {
      message: "Gate Events API работает",
      timestamp: Date.now(),
    };
  }

  @ApiOperation({ summary: "Получение списка подключенных клиентов шлагбаума" })
  @ApiResponse({
    status: 200,
    description: "Список подключенных клиентов",
  })
  @Get("clients")
  async getConnectedClients(): Promise<{
    connectedClients: Array<{
      gateId: string;
      socketId: string;
      connectedAt: Date;
      lastPing: Date;
    }>;
    expectedGateId: string;
    totalClients: number;
  }> {
    const clients = this.gateGateway.getConnectedClients();
    const expectedGateId =
      this.configService.get<string>("GATE_ID") || "main-entrance";

    this.logger.log(
      `GET /gate-events/clients - запрос списка клиентов. Найдено: ${clients.length}, ожидается: ${expectedGateId}`,
    );

    return {
      connectedClients: clients.map((c) => ({
        gateId: c.gateId,
        socketId: c.socketId,
        connectedAt: c.connectedAt,
        lastPing: c.lastPing,
      })),
      expectedGateId,
      totalClients: clients.length,
    };
  }

  @ApiOperation({ summary: "Получение событий по госномеру автомобиля" })
  @ApiResponse({
    status: 200,
    description: "Список событий для указанного автомобиля",
    type: [GateEvent],
  })
  @ApiParam({
    name: "plateNumber",
    description: "Госномер автомобиля",
    example: "01A123AA",
  })
  @Get("by-plate/:plateNumber")
  async getEventsByPlateNumber(
    @Param("plateNumber") plateNumber: string,
  ): Promise<GateEvent[]> {
    return this.gateEventsService.getEventsByPlateNumber(plateNumber);
  }

  @ApiOperation({ summary: "Отметить событие как обработанное" })
  @ApiResponse({
    status: 200,
    description: "Событие отмечено как обработанное",
  })
  @ApiParam({
    name: "eventId",
    description: "ID события",
    example: 123,
  })
  @Post("mark-processed/:eventId")
  async markEventAsProcessed(
    @Param("eventId") eventId: number,
  ): Promise<{ message: string }> {
    await this.gateEventsService.markEventAsProcessed(eventId);
    return { message: `Событие ${eventId} отмечено как обработанное` };
  }

  @ApiOperation({
    summary: "Инициализация экспорта папки uploads/gate",
    description:
      "Создает ZIP архив из папки uploads/gate и возвращает метаданные для скачивания частями. Только для ADMINGLOBAL.",
  })
  @ApiResponse({
    status: 201,
    description: "Экспорт успешно создан",
    schema: {
      type: "object",
      properties: {
        exportId: { type: "string", example: "a1b2c3d4e5f6g7h8" },
        fileName: {
          type: "string",
          example: "gate-export-a1b2c3d4e5f6g7h8.zip",
        },
        fileSize: { type: "number", example: 157286400 },
        chunkSize: { type: "number", example: 52428800 },
        chunksCount: { type: "number", example: 3 },
        expiresAt: { type: "number", example: 1704067200000 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (требуется роль ADMINGLOBAL)",
  })
  @ApiResponse({
    status: 404,
    description: "Папка uploads/gate не найдена",
  })
  @Post("export-gate/init")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async initGateExport() {
    this.logger.log(
      "POST /gate-events/export-gate/init - инициализация экспорта",
    );
    try {
      const result = await this.gateExportService.initExport();
      return {
        exportId: result.exportId,
        fileName: result.fileName,
        status: result.status,
        message:
          "Экспорт инициализирован. Используйте /export-gate/:exportId/status для проверки готовности.",
      };
    } catch (error) {
      this.logger.error(
        `Ошибка инициализации экспорта: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @ApiOperation({
    summary: "Скачать часть ZIP архива экспорта",
    description: `Скачивает указанную часть ZIP архива (по 50MB). После скачивания всех частей склейте их в один файл:
        
**Windows:**
\`\`\`
copy /b part-001.bin+part-002.bin+...+part-N.bin gate.zip
\`\`\`

**Linux/macOS:**
\`\`\`
cat part-*.bin > gate.zip
\`\`\`

Затем распакуйте gate.zip. Только для ADMINGLOBAL.`,
  })
  @ApiParam({
    name: "exportId",
    description: "ID экспорта (получен из /export-gate/init)",
    example: "a1b2c3d4e5f6g7h8",
  })
  @ApiParam({
    name: "partNumber",
    description: "Номер части (начинается с 1)",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "Часть файла успешно отправлена",
    headers: {
      "Content-Type": {
        description: "application/zip",
        schema: { type: "string" },
      },
      "Content-Disposition": {
        description: 'attachment; filename="..."',
        schema: { type: "string" },
      },
      "Content-Length": {
        description: "Размер части в байтах",
        schema: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверный номер части",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (требуется роль ADMINGLOBAL)",
  })
  @ApiResponse({
    status: 404,
    description: "Экспорт не найден или истек срок действия",
  })
  @Get("export-gate/:exportId/part/:partNumber")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async downloadExportPart(
    @Param("exportId") exportId: string,
    @Param("partNumber", ParseIntPipe) partNumber: number,
    @Res() res: Response,
  ) {
    this.logger.log(
      `GET /gate-events/export-gate/${exportId}/part/${partNumber} - запрос части экспорта`,
    );

    try {
      const chunkData = this.gateExportService.getExportChunk(
        exportId,
        partNumber,
      );

      if (!chunkData) {
        throw new HttpException(
          "Экспорт не найден или истек срок действия",
          HttpStatus.NOT_FOUND,
        );
      }

      const { stream, size, meta } = chunkData;
      const filename = `gate-export-${meta.exportId}.part-${String(partNumber).padStart(3, "0")}.bin`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", size);
      res.setHeader("X-Export-Id", meta.exportId);
      res.setHeader("X-Part-Number", partNumber);
      res.setHeader("X-Total-Parts", meta.chunksCount);

      stream.pipe(res);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Ошибка скачивания части экспорта: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Ошибка скачивания части экспорта: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({
    summary: "Получить статус экспорта",
    description:
      "Возвращает метаданные экспорта (размер, количество частей, срок действия). Только для ADMINGLOBAL.",
  })
  @ApiParam({
    name: "exportId",
    description: "ID экспорта",
    example: "a1b2c3d4e5f6g7h8",
  })
  @ApiResponse({
    status: 200,
    description: "Метаданные экспорта",
    schema: {
      type: "object",
      properties: {
        exportId: { type: "string" },
        fileName: { type: "string" },
        fileSize: { type: "number" },
        chunkSize: { type: "number" },
        chunksCount: { type: "number" },
        createdAt: { type: "number" },
        expiresAt: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (требуется роль ADMINGLOBAL)",
  })
  @ApiResponse({
    status: 404,
    description: "Экспорт не найден",
  })
  @Get("export-gate/:exportId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async getExportStatus(@Param("exportId") exportId: string) {
    this.logger.log(
      `GET /gate-events/export-gate/${exportId}/status - запрос статуса экспорта`,
    );

    const status = this.gateExportService.getExportStatus(exportId);

    if (status.status === "not_found") {
      throw new HttpException("Экспорт не найден", HttpStatus.NOT_FOUND);
    }

    if (status.status === "expired") {
      throw new HttpException("Экспорт истек", HttpStatus.GONE);
    }

    if (status.status === "processing") {
      return {
        exportId,
        status: "processing",
        message: "Экспорт еще обрабатывается. Попробуйте позже.",
      };
    }

    // Экспорт готов, возвращаем полные метаданные
    const meta = this.gateExportService.getExportMeta(exportId);
    if (!meta) {
      throw new HttpException(
        "Ошибка получения метаданных экспорта",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      exportId: meta.exportId,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      chunkSize: meta.chunkSize,
      chunksCount: meta.chunksCount,
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
      status: "ready",
    };
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
