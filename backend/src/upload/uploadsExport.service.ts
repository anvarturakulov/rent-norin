import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as fs from "fs";
import * as path from "path";
import * as archiver from "archiver";
import { v4 as uuidv4 } from "uuid";

export interface UploadsExportMeta {
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
export class UploadsExportService {
  private readonly logger = new Logger(UploadsExportService.name);
  private readonly exportsDir: string;
  private readonly uploadsDir: string;
  private readonly chunkSize: number = 50 * 1024 * 1024;
  private readonly exportTtl: number = 24 * 60 * 60 * 1000;
  private readonly inProgressExports: Map<string, Promise<UploadsExportMeta>> =
    new Map();

  constructor() {
    this.uploadsDir = path.join(process.cwd(), "uploads");
    this.exportsDir = path.join(
      process.cwd(),
      "uploads",
      "exports",
      "uploads",
    );

    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
      this.logger.log(`Created exports directory: ${this.exportsDir}`);
    }

    if (!fs.existsSync(this.uploadsDir)) {
      this.logger.warn(`Uploads directory does not exist: ${this.uploadsDir}`);
    }
  }

  async initExport(): Promise<{
    exportId: string;
    fileName: string;
    status: "processing";
  }> {
    if (!fs.existsSync(this.uploadsDir)) {
      throw new HttpException(
        `Папка uploads не существует: ${this.uploadsDir}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const exportId = uuidv4().replace(/-/g, "").substring(0, 16);
    const fileName = `uploads-export-${exportId}.zip`;
    const filePath = path.join(this.exportsDir, fileName);
    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);

    this.logger.log(`Initializing uploads export: ${fileName}`);

    const tempMeta: Partial<UploadsExportMeta> & { status: string } = {
      exportId,
      fileName,
      filePath,
      status: "processing",
      createdAt: Date.now(),
      expiresAt: Date.now() + this.exportTtl,
    };

    fs.writeFileSync(metaPath, JSON.stringify(tempMeta, null, 2));

    const exportPromise = this.createExportInternal(
      exportId,
      fileName,
      filePath,
      metaPath,
    );
    this.inProgressExports.set(exportId, exportPromise);

    exportPromise
      .then(() => {
        this.inProgressExports.delete(exportId);
        this.logger.log(`Uploads export ${exportId} completed successfully`);
      })
      .catch((error) => {
        this.inProgressExports.delete(exportId);
        this.logger.error(
          `Uploads export ${exportId} failed: ${error.message}`,
          error.stack,
        );
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            this.logger.error(
              `Failed to delete failed export file: ${e.message}`,
            );
          }
        }
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

  private async createExportInternal(
    exportId: string,
    fileName: string,
    filePath: string,
    metaPath: string,
  ): Promise<UploadsExportMeta> {
    try {
      this.logger.log(`Starting archive creation for uploads export: ${exportId}`);

      await this.createZipArchive(this.uploadsDir, filePath);

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const chunksCount = Math.ceil(fileSize / this.chunkSize);
      const createdAt = Date.now();
      const expiresAt = createdAt + this.exportTtl;

      const meta: UploadsExportMeta = {
        exportId,
        fileName,
        filePath,
        fileSize,
        chunkSize: this.chunkSize,
        chunksCount,
        createdAt,
        expiresAt,
      };

      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      this.logger.log(
        `Uploads export created: ${fileName}, size: ${(fileSize / 1024 / 1024).toFixed(2)} MB, chunks: ${chunksCount}`,
      );

      return meta;
    } catch (error) {
      this.logger.error(
        `Error creating uploads export: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async createZipArchive(
    sourceDir: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver("zip", {
        zlib: { level: 9 },
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

      const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "exports") {
          continue;
        }

        const fullPath = path.join(sourceDir, entry.name);
        if (entry.isDirectory()) {
          archive.directory(fullPath, entry.name);
        } else if (entry.isFile()) {
          archive.file(fullPath, { name: entry.name });
        }
      }

      archive.finalize();
    });
  }

  getExportMeta(exportId: string): UploadsExportMeta | null {
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

      if (Date.now() > metaData.expiresAt) {
        this.logger.warn(`Uploads export ${exportId} has expired, cleaning up...`);
        this.deleteExport(exportId);
        return null;
      }

      if (metaData.status === "processing") {
        return null;
      }

      if (!metaData.fileSize || !metaData.chunksCount) {
        return null;
      }

      return metaData as UploadsExportMeta;
    } catch (error) {
      this.logger.error(`Error reading uploads export meta: ${error.message}`);
      return null;
    }
  }

  getExportStatus(exportId: string): {
    status: "processing" | "ready" | "not_found" | "expired";
  } {
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

      if (Date.now() > metaData.expiresAt) {
        return { status: "expired" };
      }

      if (
        metaData.status === "processing" ||
        !metaData.fileSize ||
        !metaData.chunksCount
      ) {
        return { status: "processing" };
      }

      return { status: "ready" };
    } catch (error) {
      this.logger.error(
        `Error reading uploads export status: ${error.message}`,
      );
      return { status: "not_found" };
    }
  }

  getExportChunk(
    exportId: string,
    partNumber: number,
  ): { stream: fs.ReadStream; size: number; meta: UploadsExportMeta } | null {
    const meta = this.getExportMeta(exportId);
    if (!meta) {
      return null;
    }

    if (partNumber < 1 || partNumber > meta.chunksCount) {
      throw new HttpException(
        `Номер части должен быть от 1 до ${meta.chunksCount}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!fs.existsSync(meta.filePath)) {
      throw new HttpException("Файл экспорта не найден", HttpStatus.NOT_FOUND);
    }

    const start = (partNumber - 1) * meta.chunkSize;
    const end = Math.min(start + meta.chunkSize - 1, meta.fileSize - 1);
    const size = end - start + 1;
    const stream = fs.createReadStream(meta.filePath, { start, end });

    return { stream, size, meta };
  }

  deleteExport(exportId: string): void {
    const meta = this.getExportMeta(exportId);
    if (meta) {
      if (fs.existsSync(meta.filePath)) {
        fs.unlinkSync(meta.filePath);
        this.logger.log(`Deleted uploads export file: ${meta.filePath}`);
      }
    }

    const metaPath = path.join(this.exportsDir, `${exportId}.meta.json`);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      this.logger.log(`Deleted uploads export meta: ${metaPath}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredExports(): Promise<void> {
    this.logger.log("Starting cleanup of expired uploads exports...");

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
          const meta: UploadsExportMeta = JSON.parse(metaContent);

          if (now > meta.expiresAt) {
            if (fs.existsSync(meta.filePath)) {
              fs.unlinkSync(meta.filePath);
            }
            fs.unlinkSync(metaPath);
            cleanedCount++;
            this.logger.log(`Cleaned up expired uploads export: ${meta.exportId}`);
          }
        } catch (error) {
          this.logger.error(
            `Error processing uploads export meta file ${file}: ${error.message}`,
          );
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(
        `Uploads export cleanup completed: removed ${cleanedCount} expired exports`,
      );
    }
  }
}
