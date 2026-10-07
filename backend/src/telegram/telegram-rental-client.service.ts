import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramBotId } from "./telegram-bot-id";
import { RentalClientSummaryService } from "./rental-client-summary.service";
import { TelegramBotService } from "./telegram-bot.service";
import {
  escapeTelegramHtml,
  formatDateRu,
  formatDateTimeRu,
  formatMoneyRu,
} from "./telegram-html.util";

@Injectable()
export class TelegramRentalClientService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramRentalClientService.name);
  private handlersInitialized = false;

  private static readonly MENU_ACCOUNT = "Ҳисоб";
  private static readonly MENU_TOOLS = "Ускуналар";
  private static readonly MENU_CATALOG = "Каталог";
  private static readonly CATALOG_URL = "https://mebers.kord.uz/tools";

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly rentalSummary: RentalClientSummaryService,
  ) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (process.env.TELEGRAM_RENTAL_CLIENT_ENABLED === "false") return;

    const bot = this.telegramBotService.getBot(TelegramBotId.RENTAL_CLIENT);
    if (!bot) {
      this.logger.warn("Rental client bot is not initialized — handlers skipped");
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      await this.safeReply(msg.chat.id, this.getWelcomeText(), {
        parse_mode: "HTML",
        reply_markup: this.getMainKeyboard(),
      });
    });

    bot.on("message", async (msg) => {
      const text = (msg.text || "").trim();
      if (!text || /^\/?(start|help)$/i.test(text)) return;

      if (text === TelegramRentalClientService.MENU_ACCOUNT) {
        await this.handleAccount(msg);
        return;
      }
      if (text === TelegramRentalClientService.MENU_TOOLS) {
        await this.handleTools(msg);
        return;
      }
      if (text === TelegramRentalClientService.MENU_CATALOG) {
        await this.handleCatalog(msg);
        return;
      }

      await this.safeReply(
        msg.chat.id,
        "⚠️ Пастдаги тугмалардан фойдаланинг.",
        { reply_markup: this.getMainKeyboard() },
      );
    });

    this.handlersInitialized = true;
    this.logger.log("Rental client bot handlers initialized");
  }

  private getWelcomeText(): string {
    return [
      "🏗 <b>Аренда — мижоз боти</b>",
      "",
      "<b>Ҳисоб</b> — карздорлик (S40) ва жорий аренда",
      "<b>Ускуналар</b> — ҳозирги ускуналар рўйхати",
      "<b>Каталог</b> — ускуналар каталоги",
    ].join("\n");
  }

  private getMainKeyboard(): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: [
        [
          { text: TelegramRentalClientService.MENU_ACCOUNT },
          { text: TelegramRentalClientService.MENU_TOOLS },
        ],
        [{ text: TelegramRentalClientService.MENU_CATALOG }],
      ],
      resize_keyboard: true,
    };
  }

  private async handleAccount(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const client = await this.rentalSummary.getRentalClientByTelegramId(
        String(chatId),
      );
      const summary = await this.rentalSummary.getFinancialSummary(
        Number(client.id),
      );

      const lines = [
        `💰 <b>Ҳисоб</b> (${formatDateTimeRu(summary.asOf)})`,
        "",
        ` Олдинги карздорлик: <b>${formatMoneyRu(summary.s40Debt)}</b> so'm`,
        // "  → ўтказилган тўловлар ва сдать қилинмаган",
        // "",
        `Жорий ижара: <b>${formatMoneyRu(summary.accruedRentUnposted)}</b> so'm`,
        // "  → ҳали сдать қилинмаган, вақт бўйича ҳисобланган",
        "",
      ];

      if (summary.s40Debt < 0) {
        lines.push(
          `Аванс: <b>${formatMoneyRu(Math.abs(summary.s40Debt))}</b> so'm`,
          "",
        );
      }

      lines.push(
        `Жами (агар хозир барчасини топширса): <b>${formatMoneyRu(summary.totalEstimate)}</b> so'm`,
      );

      await this.safeReply(chatId, lines.join("\n"), {
        parse_mode: "HTML",
        reply_markup: this.getMainKeyboard(),
      });
    } catch (error: any) {
      await this.safeReply(
        chatId,
        `⚠️ ${escapeTelegramHtml(error?.message || "Маълумот олинмади")}`,
        { parse_mode: "HTML", reply_markup: this.getMainKeyboard() },
      );
    }
  }

  private async handleTools(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const client = await this.rentalSummary.getRentalClientByTelegramId(
        String(chatId),
      );
      const tools = await this.rentalSummary.getActiveTools(Number(client.id));

      if (!tools.length) {
        await this.safeReply(chatId, "📭 <b>Ҳозирча ускуналар йўқ</b>", {
          parse_mode: "HTML",
          reply_markup: this.getMainKeyboard(),
        });
        return;
      }

      const limit = 20;
      const shown = tools.slice(0, limit);
      const totalRent = tools.reduce((sum, t) => sum + t.accruedRentLine, 0);

      const lines = ["🔧 <b>Ускуналар</b>", ""];

      for (const t of shown) {
        lines.push(
          `• <b>${escapeTelegramHtml(t.toolName)}</b>`,
          `  Миқдор: ${t.openQty} дона`,
          `  Олинган: ${formatDateRu(t.settlementDate)}`,
          `  Тариф: ${formatMoneyRu(t.hourlyTariff)} so'm/соат`,
          `  Жорий аренда: ${formatMoneyRu(t.accruedRentLine)} so'm`,
          "",
        );
      }

      lines.push(
        `Жами: <b>${tools.length}</b> та · аренда <b>${formatMoneyRu(totalRent)}</b> so'm`,
      );

      if (tools.length > limit) {
        lines.push(`<i>Кўрсатилди ${limit} та, яна ${tools.length - limit} та</i>`);
      }

      await this.safeReply(chatId, lines.join("\n"), {
        parse_mode: "HTML",
        reply_markup: this.getMainKeyboard(),
      });
    } catch (error: any) {
      await this.safeReply(
        chatId,
        `⚠️ ${escapeTelegramHtml(error?.message || "Маълумот олинмади")}`,
        { parse_mode: "HTML", reply_markup: this.getMainKeyboard() },
      );
    }
  }

  private async handleCatalog(msg: TelegramBot.Message) {
    await this.safeReply(
      msg.chat.id,
      "🛒 <b>Каталог</b>\nПастдаги тугма орқали каталогни очинг:",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Каталогни очиш",
                url: TelegramRentalClientService.CATALOG_URL,
              },
            ],
          ],
        },
      },
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
        TelegramBotId.RENTAL_CLIENT,
      );
    } catch (error: any) {
      this.logger.error(`Rental client reply failed: ${error?.message}`);
    }
  }
}
