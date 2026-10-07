import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramBotId } from "./telegram-bot-id";
import { escapeTelegramHtml } from "./telegram-html.util";
import { TelegramBotService } from "./telegram-bot.service";

@Injectable()
export class TelegramDashboardAuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramDashboardAuthService.name);
  private handlersInitialized = false;

  constructor(private readonly telegramBotService: TelegramBotService) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (process.env.TELEGRAM_DASHBOARD_AUTH_ENABLED === "false") return;

    const bot = this.telegramBotService.getBot(TelegramBotId.DASHBOARD_AUTH);
    if (!bot) {
      this.logger.warn(
        "Dashboard auth bot is not initialized — handlers skipped",
      );
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      await this.safeReply(
        msg.chat.id,
        [
          "🔐 <b>KORD ERP — кириш коди</b>",
          "",
          "Бу бот орқали дастурга кириш учун вақтинчалик код келади.",
          "Start босилганидан сўнг код автоматик етиб келади.",
          "Кодни ҳеч кимга берманг.",
        ].join("\n"),
        { parse_mode: "HTML" },
      );
    });

    this.handlersInitialized = true;
    this.logger.log("Dashboard auth bot handlers initialized");
  }

  async sendLoginCode(telegramId: string, code: string): Promise<void> {
    const bot = this.telegramBotService.getBot(TelegramBotId.DASHBOARD_AUTH);
    if (!bot) {
      throw new Error("Dashboard auth bot is not initialized");
    }

    const safeCode = escapeTelegramHtml(code);
    await this.telegramBotService.sendMessage(
      telegramId,
      [
        "🔐 <b>KORD ERP</b>",
        "",
        `Кириш коди: <b>${safeCode}</b>`,
        "Код 5 дақиқа амал қилади. Ҳеч кимга берманг.",
      ].join("\n"),
      { parse_mode: "HTML" },
      TelegramBotId.DASHBOARD_AUTH,
    );
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
        TelegramBotId.DASHBOARD_AUTH,
      );
    } catch (error: any) {
      this.logger.error(`Dashboard auth bot reply failed: ${error?.message}`);
    }
  }
}
