import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { ReferencesService } from "src/references/references.service";
import { TelegramBotId } from "./telegram-bot-id";
import { TelegramBotService } from "./telegram-bot.service";
import {
  escapeTelegramHtml,
  formatDateShortRu,
  formatMoneyRu,
  formatTelegramPlainTable,
  formatWorkerSalaryBalanceLine,
} from "./telegram-html.util";
import { WorkerSalaryAccountService } from "./worker-salary-account.service";

@Injectable()
export class TelegramFurnitureSalaryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramFurnitureSalaryService.name);
  private handlersInitialized = false;

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly referencesService: ReferencesService,
    private readonly workerSalaryAccountService: WorkerSalaryAccountService,
  ) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (process.env.TELEGRAM_FURNITURE_SALARY_ENABLED === "false") return;

    const bot = this.telegramBotService.getBot(TelegramBotId.FURNITURE_SALARY);
    if (!bot) {
      this.logger.warn("Furniture salary bot is not initialized — handlers skipped");
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      await this.safeReply(
        msg.chat.id,
        [
          "💵 <b>Иш ҳақи боти</b>",
          "",
          "Команда: <b>?</b> — Иш хаки колдиги",
          "Команда: <b>?10</b> — охирги 10 кун (жадвал)",
          "Ёки: <b>зарплата</b> — колдик",
        ].join("\n"),
        { parse_mode: "HTML" },
      );
    });

    bot.onText(/^(?:\?|зарплата)(\d{0,3})?$/i, async (msg, match) => {
      await this.handleSalaryQuery(msg, match?.[1]);
    });

    this.handlersInitialized = true;
    this.logger.log("Furniture salary bot handlers initialized");
  }

  /**
   * WORKERS — общий справочник (enterpriseId = null). Нельзя подставлять
   * TELEGRAM_ENTERPRISE_FURNITURE: тогда остаток второй организации всегда 0.
   * null = остаток/движения по всем организациям этого сотрудника.
   */
  private resolveEnterpriseId(
    worker: { enterpriseId?: number | null },
  ): number | null {
    if (
      worker.enterpriseId != null &&
      Number.isFinite(Number(worker.enterpriseId))
    ) {
      return Number(worker.enterpriseId);
    }
    return null;
  }

  private async handleSalaryQuery(
    msg: TelegramBot.Message,
    daysRaw?: string,
  ) {
    const chatId = msg.chat.id;

    try {
      const worker = await this.referencesService.getWorker(String(chatId));
      if (!worker?.id) {
        throw new Error(
          "Сотрудник не найден. Привяжите Telegram ID в справочнике WORKERS.",
        );
      }

      const workerId = Number(worker.id);
      const enterpriseId = this.resolveEnterpriseId(worker);

      if (daysRaw) {
        await this.replyMovementsTable(
          chatId,
          worker,
          workerId,
          enterpriseId,
          daysRaw,
        );
        return;
      }

      const balance = await this.workerSalaryAccountService.getS67Balance(
        workerId,
        enterpriseId,
      );

      const lines = [
        "💵 <b>Иш ҳақи (S67)</b>",
        `Ходим: <b>${escapeTelegramHtml(worker.name || "")}</b>`,
        formatWorkerSalaryBalanceLine(balance),
      ];

      await this.safeReply(chatId, lines.join("\n"), { parse_mode: "HTML" });
    } catch (error: any) {
      await this.safeReply(
        chatId,
        `⚠️ ${escapeTelegramHtml(error?.message || "Маълумот олинмади")}`,
        { parse_mode: "HTML" },
      );
    }
  }

  private async replyMovementsTable(
    chatId: number,
    worker: { name?: string | null },
    workerId: number,
    enterpriseId: number | null,
    daysRaw: string,
  ) {
    const days = Math.max(1, Math.min(365, Number(daysRaw)));
    const dateTo = Date.now();
    const dateFrom = dateTo - days * 24 * 60 * 60 * 1000;

    const rows = await this.workerSalaryAccountService.getS67Movements(
      workerId,
      enterpriseId,
      dateFrom,
      dateTo,
    );

    const lines = [
      `📋 <b>Иш ҳақи (S67)</b> — oxirgi ${days} kun`,
      `Ходим: <b>${escapeTelegramHtml(worker.name || "")}</b>`,
      "",
    ];

    if (!rows.length) {
      lines.push("📭 Ushbu davrda operatsiya yo'q.");
      await this.safeReply(chatId, lines.join("\n"), { parse_mode: "HTML" });
      return;
    }

    const table = formatTelegramPlainTable(
      [
        { header: "Сана", width: 8 },
        { header: "Тури", width: 8 },
        { header: "Хисоб", width: 9, align: "right" },
        { header: "Тулов", width: 9, align: "right" },
      ],
      rows.map((row) => [
        formatDateShortRu(row.date),
        row.typeLabel,
        row.accrual ? formatMoneyRu(row.accrual) : "",
        row.payment ? formatMoneyRu(row.payment) : "",
      ]),
    );

    lines.push(`<pre>${escapeTelegramHtml(table)}</pre>`);
    await this.safeReply(chatId, lines.join("\n"), { parse_mode: "HTML" });
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
        TelegramBotId.FURNITURE_SALARY,
      );
    } catch (error: any) {
      this.logger.error(`Salary bot reply failed: ${error?.message}`);
    }
  }
}
