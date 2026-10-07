import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramBotId } from "./telegram-bot-id";
import { getMiniAppFrontendUrl } from "./telegram-env";
import { TelegramBotService } from "./telegram-bot.service";

@Injectable()
export class TelegramFurnitureWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramFurnitureWorkerService.name);
  private handlersInitialized = false;

  constructor(private readonly telegramBotService: TelegramBotService) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (process.env.TELEGRAM_FURNITURE_WORKER_ENABLED === "false") return;

    const bot = this.telegramBotService.getBot(TelegramBotId.FURNITURE_WORKER);
    if (!bot) {
      this.logger.warn("Furniture worker bot is not initialized — handlers skipped");
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      const webAppUrl = getMiniAppFrontendUrl();
      await this.safeReply(
        msg.chat.id,
        [
          "🏭 <b>Ишлаб чиқариш — цех</b>",
          "",
          "«Менинг ишларим» тугмасини босинг — дастурга киринг.",
          "Иш ҳақи учун алохида salary-ботга <b>?</b> юборинг.",
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [
                {
                  text: "Менинг ишларим",
                  web_app: { url: webAppUrl },
                },
              ],
            ],
            resize_keyboard: true,
          },
        },
      );
    });

    this.handlersInitialized = true;
    this.logger.log("Furniture worker bot handlers initialized");
  }

  private async safeReply(
    chatId: number,
    text: string,
    options?: TelegramBot.SendMessageOptions,
  ) {
    try {
      await this.telegramBotService.sendMessage(
        chatId,
        text,
        options,
        TelegramBotId.FURNITURE_WORKER,
      );
    } catch (error: any) {
      this.logger.error(`Worker bot reply failed: ${error?.message}`);
    }
  }
}
