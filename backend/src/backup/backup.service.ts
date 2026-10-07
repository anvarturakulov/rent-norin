import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TelegramBotService } from "src/telegram/telegram-bot.service";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as archiver from "archiver";
import { promisify } from "util";
import * as https from "https";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.join(__dirname, "..", "..", "backups");

  constructor(private telegramBotService: TelegramBotService) {
    // Проверка переменных окружения
    this.logger.log(
      "BOT_TOKENBACKUP:",
      process.env.BOT_TOKENBACKUP ? "Set" : "Missing",
    );
    this.logger.log("POSTGRES_DB:", process.env.POSTGRES_DB || "Missing");
    this.logger.log("POSTGRES_PORT:", process.env.POSTGRES_PORT || "Missing");
    this.logger.log(
      "TELEGRAM_USER_IDS:",
      process.env.TELEGRAM_USER_IDS || "Missing",
    );

    // Проверка сетевой доступности Telegram API отключена
    // this.checkTelegramApiAvailability();

    // Создание директории для бэкапов
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
        this.logger.log(`Backup directory created: ${this.backupDir}`);
      } catch (error) {
        this.logger.error(
          `Failed to create backup directory: ${error.message}`,
        );
        throw error;
      }
    }

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error(
        `Unhandled Rejection at: ${promise}, reason: ${reason}`,
      );
    });
  }

  // Проверка доступности Telegram API
  private async checkTelegramApiAvailability() {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = https.get("https://api.telegram.org", (res) => {
          if (res.statusCode === 200 || res.statusCode === 302) {
            this.logger.log(
              `Telegram API is accessible (status: ${res.statusCode})`,
            );
            resolve();
          } else {
            reject(
              new Error(`Telegram API returned status: ${res.statusCode}`),
            );
          }
        });
        req.on("error", (error) => {
          reject(new Error(`Failed to reach Telegram API: ${error.message}`));
        });
        req.end();
      });
    } catch (error) {
      this.logger.error(`Telegram API check failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyBackup() {
    this.logger.log("Starting daily PostgreSQL backup...");

    try {
      const backupFile = await this.createBackup();
      const zipFile = await this.createZipArchive(backupFile);
      await this.sendBackupToTelegram(zipFile);
      this.logger.log("Backup completed, zipped, and sent to Telegram.");
    } catch (error) {
      this.logger.error("Backup process failed:", error);
    }
  }

  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.sql`);

    const pgDumpArgs = [
      `-h ${process.env.POSTGRES_HOST}`,
      `-p ${process.env.POSTGRES_PORT}`,
      `-U ${process.env.POSTGRES_USER}`,
      `-d ${process.env.POSTGRES_DB}`,
      "-F p",
    ];

    try {
      await new Promise<void>((resolve, reject) => {
        const pgDump = spawn("pg_dump", pgDumpArgs, {
          env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD },
          shell: true,
        });

        const writeStream = fs.createWriteStream(backupFile);

        pgDump.stdout.pipe(writeStream);

        pgDump.stderr.on("data", (data) => {
          this.logger.error(`pg_dump stderr: ${data}`);
        });

        pgDump.on("error", (error) => {
          reject(new Error(`pg_dump error: ${error.message}`));
        });

        pgDump.on("close", (code) => {
          writeStream.close();
          if (code !== 0) {
            reject(new Error(`pg_dump exited with code ${code}`));
          } else {
            resolve();
          }
        });
      });

      this.logger.log(`Backup command executed: ${backupFile}`);

      let retries = 10;
      let fileSize = 0;
      let lastSize = -1;

      while (retries > 0) {
        if (fs.existsSync(backupFile)) {
          const stats = fs.statSync(backupFile);
          fileSize = stats.size;

          if (fileSize > 0 && fileSize === lastSize) {
            this.logger.log(
              `Backup file ready: ${backupFile}, size: ${fileSize} bytes`,
            );
            return backupFile;
          }

          lastSize = fileSize;
          this.logger.log(
            `File exists, size: ${fileSize} bytes, waiting for completion...`,
          );
        } else {
          this.logger.log(`Backup file not yet created: ${backupFile}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries--;
      }

      this.logger.error(
        `Backup file not found or not ready after retries: ${backupFile}`,
      );
      throw new Error(`Backup file not ready: ${backupFile}`);
    } catch (error) {
      this.logger.error("Error creating backup:", error);
      throw error;
    }
  }

  private async createZipArchive(backupFile: string): Promise<string> {
    const zipFile = backupFile.replace(".sql", ".zip");
    const output = fs.createWriteStream(zipFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    try {
      await new Promise<void>((resolve, reject) => {
        output.on("close", () => {
          this.logger.log(
            `ZIP archive created: ${zipFile}, size: ${archive.pointer()} bytes`,
          );
          resolve();
        });

        archive.on("error", (error) => {
          this.logger.error(`Archiver error: ${error.message}`);
          reject(error);
        });

        archive.pipe(output);
        archive.file(backupFile, { name: path.basename(backupFile) });
        archive.finalize();
      });

      // Удаляем исходный SQL-файл
      try {
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
          this.logger.log(`Original SQL file deleted: ${backupFile}`);
        }
      } catch (error) {
        this.logger.error(`Error deleting SQL file: ${error.message}`);
      }

      return zipFile;
    } catch (error) {
      this.logger.error("Error creating ZIP archive:", error);
      throw error;
    }
  }

  private async sendBackupToTelegram(zipFile: string) {
    const userIds = [
      ...new Set(
        process.env.TELEGRAM_USER_IDS?.split(",").map((id) => id.trim()) || [],
      ),
    ];
    this.logger.log("Parsed TELEGRAM_USER_IDS:", userIds);

    if (!userIds.length) {
      this.logger.warn(
        "No TELEGRAM_USER_IDS provided; skipping Telegram send.",
      );
      return;
    }

    const normalizedZipFile = path.normalize(zipFile);
    const fileName = path.basename(normalizedZipFile);

    if (!fs.existsSync(normalizedZipFile)) {
      this.logger.error(`ZIP file does not exist: ${normalizedZipFile}`);
      return;
    }

    // Проверка размера файла
    const stats = fs.statSync(normalizedZipFile);
    const fileSizeMB = stats.size / (1024 * 1024);
    this.logger.log(`ZIP file size: ${fileSizeMB.toFixed(2)} MB`);

    if (fileSizeMB > 50) {
      this.logger.error(
        `ZIP file size (${fileSizeMB.toFixed(2)} MB) exceeds Telegram's 50 MB limit for bots.`,
      );
      return;
    }

    for (const userId of userIds) {
      try {
        this.logger.log(`Attempting to send ZIP backup to userId: ${userId}`);
        await this.telegramBotService.sendDocument(
          userId,
          fs.createReadStream(normalizedZipFile),
          {
            caption: `Daily PostgreSQL backup for ${process.env.POSTGRES_DB || "unknown"} - ${new Date().toISOString()}`,
            filename: fileName,
            contentType: "application/zip",
          },
        );
        this.logger.log(`ZIP backup sent to user ${userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send ZIP backup to user ${userId}: ${error.message}`,
          error.stack,
        );
      }
    }

    // Удаление ZIP-файла
    // try {
    //   if (fs.existsSync(normalizedZipFile)) {
    //     fs.unlinkSync(normalizedZipFile);
    //     this.logger.log(`ZIP file deleted: ${normalizedZipFile}`);
    //   } else {
    //     this.logger.warn(`ZIP file already deleted or not found: ${normalizedZipFile}`);
    //   }
    // } catch (error) {
    //   this.logger.error('Error deleting ZIP file:', error);
    // }
  }
}
