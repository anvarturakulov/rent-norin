import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as fs from "fs";
import * as path from "path";
import * as archiver from "archiver";
import { v4 as uuidv4 } from "uuid";

export interface ExportMeta {
  exportId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  chunkSize: number;
  chunksCount: number;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class GateExportService {
  private readonly logger = new Logger(GateExportService.name);
  private readonly exportsDir: string;
  private readonly gateDir: string;
  private readonly chunkSize: number = 50 * 1024 * 1024; // 50 MB
  private readonly exportTtl: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly inProgressExports: Map<string, Promise<ExportMeta>> =
    new Map();

  constructor() {
    this.exportsDir = path.join(process.cwd(), "uploads", "exports", "gate");
    this.gateDir = path.join(process.cwd(), "uploads", "gate");

    // Создаем директории если их нет
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
      this.logger.log(`Created exports directory: ${this.exportsDir}`);
    }

    if (!fs.existsSync(this.gateDir)) {
      this.logger.warn(`Gate directory does not exist: ${this.gateDir}`);
    }
  }

  /**
   * Инициализирует создание экспорта (создает метаданные и запускает создание архива в фоне)
   * @returns Метаданные экспорта (без fileSize и chunksCount, они будут добавлены позже)
   */
  async initExport(): Promise<{
    exportId: string;
    fileName: string;
    status: "processing";
  }> {
    if (!fs.existsSync(this.gateDir)) {
      throw new HttpException(
        `Папка uploads/gate не существует: ${this.gateDir}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const exportId = uuidv4().replace(/-/g, "").substring(0, 16); // Короткий ID
    const fileName = `gate-export-${exportId}.zip`;
    const filePath = path.join(this.exportsDir, fileName);
    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);

    this.logger.log(`Initializing export: ${fileName}`);

    // Создаем временные метаданные со статусом "processing"
    const tempMeta: Partial<ExportMeta> & { status: string } = {
      exportId,
      fileName,
      filePath,
      status: "processing",
      createdAt: Date.now(),
      expiresAt: Date.now() + this.exportTtl,
    };

    // Сохраняем временные метаданные
    fs.writeFileSync(metaPath, JSON.stringify(tempMeta, null, 2));

    // Запускаем создание архива в фоне (не блокируем запрос)
    const exportPromise = this.createExportInternal(
      exportId,
      fileName,
      filePath,
      metaPath,
    );
    this.inProgressExports.set(exportId, exportPromise);

    // Обрабатываем завершение экспорта
    exportPromise
      .then(() => {
        this.inProgressExports.delete(exportId);
        this.logger.log(`Export ${exportId} completed successfully`);
      })
      .catch((error) => {
        this.inProgressExports.delete(exportId);
        this.logger.error(
          `Export ${exportId} failed: ${error.message}`,
          error.stack,
        );
        // Удаляем файл если он был создан
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            this.logger.error(
              `Failed to delete failed export file: ${e.message}`,
            );
          }
        }
        // Удаляем метаданные
        if (fs.existsSync(metaPath)) {
          try {
            fs.unlinkSync(metaPath);
          } catch (e) {
            this.logger.error(
              `Failed to delete failed export meta: ${e.message}`,
            );
          }
        }
      });

    return {
      exportId,
      fileName,
      status: "processing",
    };
  }

  /**
   * Внутренний метод создания экспорта
   */
  private async createExportInternal(
    exportId: string,
    fileName: string,
    filePath: string,
    metaPath: string,
  ): Promise<ExportMeta> {
    try {
      this.logger.log(`Starting archive creation for export: ${exportId}`);

      // Создаем ZIP архив
      await this.createZipArchive(this.gateDir, filePath);

      // Получаем размер файла
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const chunksCount = Math.ceil(fileSize / this.chunkSize);
      const createdAt = Date.now();
      const expiresAt = createdAt + this.exportTtl;

      const meta: ExportMeta = {
        exportId,
        fileName,
        filePath,
        fileSize,
        chunkSize: this.chunkSize,
        chunksCount,
        createdAt,
        expiresAt,
      };

      // Обновляем метаданные с полной информацией
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      this.logger.log(
        `Export created: ${fileName}, size: ${(fileSize / 1024 / 1024).toFixed(2)} MB, chunks: ${chunksCount}`,
      );

      return meta;
    } catch (error) {
      this.logger.error(`Error creating export: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Создает ZIP архив из указанной директории
   */
  private async createZipArchive(
    sourceDir: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Максимальное сжатие
      });

      output.on("close", () => {
        this.logger.log(
          `ZIP archive created: ${outputPath}, size: ${archive.pointer()} bytes`,
        );
        resolve();
      });

      archive.on("error", (error) => {
        this.logger.error(`Archiver error: ${error.message}`);
        reject(error);
      });

      archive.pipe(output);

      // Рекурсивно добавляем все файлы из sourceDir
      // Сохраняем структуру папок относительно uploads/gate
      archive.directory(sourceDir, false);

      archive.finalize();
    });
  }

  /**
   * Получает метаданные экспорта
   */
  getExportMeta(exportId: string): ExportMeta | null {
    // Валидация exportId (защита от path traversal)
    if (!/^[a-zA-Z0-9_-]+$/.test(exportId)) {
      throw new HttpException(
        "Неверный формат exportId",
        HttpStatus.BAD_REQUEST,
      );
    }

    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);

    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const metaContent = fs.readFileSync(metaPath, "utf-8");
      const metaData = JSON.parse(metaContent);

      // Проверяем срок действия
      if (Date.now() > metaData.expiresAt) {
        this.logger.warn(`Export ${exportId} has expired, cleaning up...`);
        this.deleteExport(exportId);
        return null;
      }

      // Если экспорт еще обрабатывается, возвращаем null (или можно вернуть статус)
      if (metaData.status === "processing") {
        return null; // Или можно вернуть специальный статус
      }

      // Проверяем, что все необходимые поля присутствуют
      if (!metaData.fileSize || !metaData.chunksCount) {
        // Экспорт еще не готов
        return null;
      }

      const meta: ExportMeta = metaData as ExportMeta;
      return meta;
    } catch (error) {
      this.logger.error(`Error reading export meta: ${error.message}`);
      return null;
    }
  }

  /**
   * Проверяет статус экспорта
   */
  getExportStatus(exportId: string): {
    status: "processing" | "ready" | "not_found" | "expired";
  } {
    // Валидация exportId
    if (!/^[a-zA-Z0-9_-]+$/.test(exportId)) {
      throw new HttpException(
        "Неверный формат exportId",
        HttpStatus.BAD_REQUEST,
      );
    }

    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);

    if (!fs.existsSync(metaPath)) {
      return { status: "not_found" };
    }

    try {
      const metaContent = fs.readFileSync(metaPath, "utf-8");
      const metaData = JSON.parse(metaContent);

      // Проверяем срок действия
      if (Date.now() > metaData.expiresAt) {
        return { status: "expired" };
      }

      // Если экспорт еще обрабатывается
      if (
        metaData.status === "processing" ||
        !metaData.fileSize ||
        !metaData.chunksCount
      ) {
        return { status: "processing" };
      }

      return { status: "ready" };
    } catch (error) {
      this.logger.error(`Error reading export status: ${error.message}`);
      return { status: "not_found" };
    }
  }

  /**
   * Получает поток для чтения части файла
   */
  getExportChunk(
    exportId: string,
    partNumber: number,
  ): { stream: fs.ReadStream; size: number; meta: ExportMeta } | null {
    const meta = this.getExportMeta(exportId);
    if (!meta) {
      return null;
    }

    // Валидация номера части
    if (partNumber < 1 || partNumber > meta.chunksCount) {
      throw new HttpException(
        `Номер части должен быть от 1 до ${meta.chunksCount}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!fs.existsSync(meta.filePath)) {
      throw new HttpException("Файл экспорта не найден", HttpStatus.NOT_FOUND);
    }

    // Вычисляем диапазон байт для этой части
    const start = (partNumber - 1) * meta.chunkSize;
    const end = Math.min(start + meta.chunkSize - 1, meta.fileSize - 1);
    const size = end - start + 1;

    // Создаем поток чтения для указанного диапазона
    const stream = fs.createReadStream(meta.filePath, { start, end });

    return { stream, size, meta };
  }

  /**
   * Удаляет экспорт (файл и метаданные)
   */
  deleteExport(exportId: string): void {
    const meta = this.getExportMeta(exportId);
    if (meta) {
      // Удаляем файл
      if (fs.existsSync(meta.filePath)) {
        fs.unlinkSync(meta.filePath);
        this.logger.log(`Deleted export file: ${meta.filePath}`);
      }
    }

    // Удаляем метаданные
    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      this.logger.log(`Deleted export meta: ${metaPath}`);
    }
  }

  /**
   * Cron задача: очистка устаревших экспортов (каждый час)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredExports(): Promise<void> {
    this.logger.log("Starting cleanup of expired exports...");

    if (!fs.existsSync(this.exportsDir)) {
      return;
    }

    const files = fs.readdirSync(this.exportsDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (file.endsWith(".meta.json")) {
        const metaPath = path.join(this.exportsDir, file);
        try {
          const metaContent = fs.readFileSync(metaPath, "utf-8");
          const meta: ExportMeta = JSON.parse(metaContent);

          if (now > meta.expiresAt) {
            // Удаляем файл экспорта
            if (fs.existsSync(meta.filePath)) {
              fs.unlinkSync(meta.filePath);
            }
            // Удаляем метаданные
            fs.unlinkSync(metaPath);
            cleanedCount++;
            this.logger.log(`Cleaned up expired export: ${meta.exportId}`);
          }
        } catch (error) {
          this.logger.error(
            `Error processing meta file ${file}: ${error.message}`,
          );
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(
        `Cleanup completed: removed ${cleanedCount} expired exports`,
      );
    }
  }
}
