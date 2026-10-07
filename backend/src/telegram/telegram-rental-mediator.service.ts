import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { ReferencesService } from "src/references/references.service";
import { ReportsService } from "src/reports/reports.service";
import { TelegramBotId } from "./telegram-bot-id";
import { getTelegramEnterpriseRental } from "./telegram-env";
import { TelegramBotService } from "./telegram-bot.service";
import {
  escapeTelegramHtml,
  formatDateTimeRu,
  formatMoneyRu,
} from "./telegram-html.util";

@Injectable()
export class TelegramRentalMediatorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramRentalMediatorService.name);
  private handlersInitialized = false;

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly referencesService: ReferencesService,
    private readonly reportsService: ReportsService,
  ) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (process.env.TELEGRAM_RENTAL_MEDIATOR_ENABLED === "false") return;

    const bot = this.telegramBotService.getBot(TelegramBotId.RENTAL_MEDIATOR);
    if (!bot) {
      this.logger.warn("Rental mediator bot is not initialized — handlers skipped");
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      await this.safeReply(
        msg.chat.id,
        [
          "🤝 <b>Mediator боти</b>",
          "",
          "Bonus qoldig'i: yuboring <b>?</b> (S65)",
          "",
          "Ro'yxatdan o'tish: ERP → <b>Партнёры</b> → галочка <b>Хайдовчи</b> yoki <b>Уста</b> + <b>Telegram ID</b>.",
        ].join("\n"),
        { parse_mode: "HTML" },
      );
    });

    bot.onText(/^\?(\d{0,3})?$/i, async (msg, match) => {
      if (match?.[1]) {
        await this.safeReply(
          msg.chat.id,
          "ℹ️ Для баланса отправьте <b>?</b> без числа.",
          { parse_mode: "HTML" },
        );
        return;
      }
      await this.handleBonusQuery(msg);
    });

    this.handlersInitialized = true;
    this.logger.log("Rental mediator bot handlers initialized");
  }

  private async handleBonusQuery(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const enterpriseId = getTelegramEnterpriseRental();

    try {
      const partner =
        await this.referencesService.findPartnerMediatorByTelegramId(
          String(chatId),
          enterpriseId,
        );
      const partnerId = Number(partner.id);
      const rv = (partner as any).refValues;
      const typeLabel = rv?.isMediatorDriver
        ? "Шофёр"
        : rv?.isMediatorMaster
          ? "Уста"
          : "—";

      const bonus = await this.reportsService.getMediatorBonusBalance(
        partnerId,
        enterpriseId,
      );
      await this.safeReply(
        chatId,
        [
          `🎁 <b>Bonus (S65)</b>`,
          `Тури: <b>${escapeTelegramHtml(typeLabel)}</b>`,
          `Қолдиқ: <b>${formatMoneyRu(bonus.balance)}</b> so'm`,
          `Ҳисобланган: ${formatMoneyRu(bonus.accrued)} so'm`,
          `Тўланган: ${formatMoneyRu(bonus.paid)} so'm`,
          `Сана: ${formatDateTimeRu(bonus.asOf)}`,
        ].join("\n"),
        { parse_mode: "HTML" },
      );
    } catch (error: any) {
      await this.safeReply(
        chatId,
        `⚠️ ${escapeTelegramHtml(error?.message || "Маълумот олинмади")}`,
        { parse_mode: "HTML" },
      );
    }
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
        TelegramBotId.RENTAL_MEDIATOR,
      );
    } catch (error: any) {
      this.logger.error(`Rental mediator reply failed: ${error?.message}`);
    }
  }
}
