import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramBotId } from "./telegram-bot-id";
import {
  getBotToken,
  isBotEnabled,
  isBotPollingEnabled,
} from "./telegram-env";

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly bots = new Map<TelegramBotId, TelegramBot>();
  /** Один токен — один инстанс (legacy BOT_TOKEN = FURNITURE_CLIENT). */
  private readonly tokenToBotId = new Map<string, TelegramBotId>();

  async onModuleInit() {
    await this.initializeBots();
  }

  private async initializeBots() {
    const ids: TelegramBotId[] = [
      TelegramBotId.FURNITURE_CLIENT,
      TelegramBotId.FURNITURE_WORKER,
      TelegramBotId.FURNITURE_SALARY,
      TelegramBotId.RENTAL_MEDIATOR,
      TelegramBotId.RENTAL_CLIENT,
      TelegramBotId.BACKUP,
      TelegramBotId.DASHBOARD_AUTH,
    ];

    for (const botId of ids) {
      if (!isBotEnabled(botId)) {
        this.logger.log(`Telegram bot ${botId} disabled by env`);
        continue;
      }
      const token = getBotToken(botId);
      if (!token) {
        this.logger.warn(`Token not set for bot ${botId}`);
        continue;
      }
      if (this.tokenToBotId.has(token)) {
        const existingId = this.tokenToBotId.get(token)!;
        this.bots.set(botId, this.bots.get(existingId)!);
        this.logger.log(`Bot ${botId} reuses instance of ${existingId} (same token)`);
        continue;
      }

      const enablePolling = isBotPollingEnabled(botId);
      const bot = new TelegramBot(token, { polling: false });

      bot.on("error", (error) => {
        this.logger.error(`Bot ${botId} error: ${error.message}`, error.stack);
      });

      if (enablePolling) {
        await this.startPollingForBot(bot, botId);
      }

      this.bots.set(botId, bot);
      this.tokenToBotId.set(token, botId);
      this.logger.log(
        `Telegram bot ${botId} initialized (polling=${enablePolling})`,
      );
    }
  }

  private async startPollingForBot(bot: TelegramBot, botId: TelegramBotId) {
    try {
      await bot.deleteWebHook();
      try {
        const updates = await bot.getUpdates({ offset: -1, limit: 100 });
        if (updates.length > 0) {
          this.logger.log(`Bot ${botId}: cleared ${updates.length} pending updates`);
        }
      } catch (e: any) {
        this.logger.warn(`Bot ${botId}: could not clear updates: ${e?.message}`);
      }

      await new Promise((r) => setTimeout(r, 1500));

      await bot.startPolling({
        restart: true,
        polling: {
          interval: 3000,
          params: {
            timeout: 30,
            allowed_updates: ["message", "callback_query"],
          },
        },
      });
      this.logger.log(`Bot ${botId}: polling started`);

      bot.on("polling_error", (error) => {
        this.logger.error(`Bot ${botId} polling error: ${error.message}`);
        if (
          error.message.includes("409") ||
          error.message.includes("Conflict")
        ) {
          this.logger.warn(`Bot ${botId}: 409 conflict — stop polling`);
          void bot.stopPolling({ cancel: true, reason: "409 conflict" });
        }
      });
    } catch (error: any) {
      this.logger.error(
        `Bot ${botId}: failed to start polling: ${error?.message}`,
      );
    }
  }

  getBot(botId: TelegramBotId): TelegramBot | null {
    return this.bots.get(botId) ?? null;
  }

  /** @deprecated use getBot(TelegramBotId.FURNITURE_CLIENT) */
  getMainBot(): TelegramBot | null {
    return this.getBot(TelegramBotId.FURNITURE_CLIENT);
  }

  getBackupBot(): TelegramBot | null {
    return this.getBot(TelegramBotId.BACKUP);
  }

  async sendMessage(
    chatId: string | number,
    message: string,
    options?: TelegramBot.SendMessageOptions,
    botId: TelegramBotId = TelegramBotId.FURNITURE_CLIENT,
  ): Promise<void> {
    const bot = this.getBot(botId);
    if (!bot) {
      this.logger.warn(`Cannot sendMessage: bot ${botId} not initialized`);
      return;
    }
    try {
      await bot.sendMessage(chatId, message, options);
    } catch (error: any) {
      this.logger.error(
        `sendMessage failed (${botId}): ${error?.message}`,
      );
      throw error;
    }
  }

  async sendDocument(
    chatId: string | number,
    document: any,
    options?: any,
    botId?: TelegramBotId,
  ): Promise<void> {
    const bot =
      (botId ? this.getBot(botId) : null) ||
      this.getBot(TelegramBotId.BACKUP) ||
      this.getBot(TelegramBotId.FURNITURE_CLIENT);
    if (!bot) {
      this.logger.warn("No Telegram bot for sendDocument");
      return;
    }
    try {
      await bot.sendDocument(chatId, document, options);
    } catch (error: any) {
      this.logger.error(`sendDocument failed: ${error?.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    for (const [botId, bot] of this.bots.entries()) {
      try {
        await bot.stopPolling({
          cancel: true,
          reason: "Application shutdown",
        });
        this.logger.log(`Bot ${botId} polling stopped`);
      } catch (error: any) {
        this.logger.warn(`Bot ${botId} stop error: ${error?.message}`);
      }
    }
  }
}
