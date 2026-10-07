import {
  Controller,
  Post,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Res,
  ParseIntPipe,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles-auth.decorator";
import { UserRoles } from "../interfaces/user.interface";
import { UploadsExportService } from "./uploadsExport.service";

@ApiTags("Upload")
@Controller("upload")
export class UploadsExportController {
  private readonly logger = new Logger(UploadsExportController.name);

  constructor(private readonly uploadsExportService: UploadsExportService) {}

  @ApiOperation({
    summary: "Инициализация экспорта папки uploads",
    description:
      "Создает ZIP архив из папки uploads (кроме uploads/exports) и возвращает метаданные для скачивания частями. Только для ADMINGLOBAL.",
  })
  @ApiResponse({
    status: 201,
    description: "Экспорт успешно инициализирован",
  })
  @ApiResponse({
    status: 403,
    description: "Доступ запрещен (требуется роль ADMINGLOBAL)",
  })
  @ApiResponse({
    status: 404,
    description: "Папка uploads не найдена",
  })
  @Post("export-uploads/init")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async initUploadsExport() {
    this.logger.log("POST /upload/export-uploads/init - инициализация экспорта");
    const result = await this.uploadsExportService.initExport();
    return {
      exportId: result.exportId,
      fileName: result.fileName,
      status: result.status,
      message:
        "Экспорт инициализирован. Используйте /export-uploads/:exportId/status для проверки готовности.",
    };
  }

  @ApiOperation({
    summary: "Скачать часть ZIP архива экспорта uploads",
    description:
      "Скачивает указанную часть ZIP архива (по 50MB). Только для ADMINGLOBAL.",
  })
  @ApiParam({
    name: "exportId",
    description: "ID экспорта (получен из /export-uploads/init)",
    example: "a1b2c3d4e5f6g7h8",
  })
  @ApiParam({
    name: "partNumber",
    description: "Номер части (начинается с 1)",
    example: 1,
  })
  @Get("export-uploads/:exportId/part/:partNumber")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async downloadExportPart(
    @Param("exportId") exportId: string,
    @Param("partNumber", ParseIntPipe) partNumber: number,
    @Res() res: Response,
  ) {
    this.logger.log(
      `GET /upload/export-uploads/${exportId}/part/${partNumber} - запрос части экспорта`,
    );

    const chunkData = this.uploadsExportService.getExportChunk(
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
    const filename = `uploads-export-${meta.exportId}.part-${String(partNumber).padStart(3, "0")}.bin`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", size);
    res.setHeader("X-Export-Id", meta.exportId);
    res.setHeader("X-Part-Number", partNumber);
    res.setHeader("X-Total-Parts", meta.chunksCount);

    stream.pipe(res);
  }

  @ApiOperation({
    summary: "Получить статус экспорта uploads",
    description:
      "Возвращает метаданные экспорта (размер, количество частей, срок действия). Только для ADMINGLOBAL.",
  })
  @ApiParam({
    name: "exportId",
    description: "ID экспорта",
    example: "a1b2c3d4e5f6g7h8",
  })
  @Get("export-uploads/:exportId/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.ADMINGLOBAL)
  async getExportStatus(@Param("exportId") exportId: string) {
    this.logger.log(
      `GET /upload/export-uploads/${exportId}/status - запрос статуса экспорта`,
    );

    const status = this.uploadsExportService.getExportStatus(exportId);

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

    const meta = this.uploadsExportService.getExportMeta(exportId);
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
}
