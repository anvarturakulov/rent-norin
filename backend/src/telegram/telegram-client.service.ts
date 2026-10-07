import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { FurnitureOrdersService } from "src/furnitureOrders/furnitureOrders.service";
import { ReportsService } from "src/reports/reports.service";
import { ReferencesService } from "src/references/references.service";
import { TelegramBotService } from "./telegram-bot.service";
import { TelegramBotId } from "./telegram-bot-id";
import { getTelegramEnterpriseFurniture, isBotEnabled } from "./telegram-env";
import {
  normalizeOrderStage,
  OrderHistoryEventType,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";
import {
  TypePartners,
  TypeReference,
} from "src/interfaces/reference.interface";
import { UpdateCreateReferenceDto } from "src/references/dto/updateCreateReference.dto";
import { join } from "path";

type NewRequestWizardStep = "name" | "furniture" | "phone";

interface NewRequestWizardState {
  step: NewRequestWizardStep;
  displayName?: string;
  furniture?: string;
  /** Уже заведённый клиент по telegramId — не спрашиваем имя */
  existingClientId?: number;
  /** В БД уже был непустой телефон — не спрашиваем номер */
  hadPhoneInDb?: boolean;
  /** Телефон из БД (если hadPhoneInDb) — для комментария без шага phone */
  savedPhoneFromDb?: string;
}

@Injectable()
export class TelegramClientService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramClientService.name);
  private handlersInitialized = false;
  private readonly ordersPageSize = 10;
  private readonly maxFilesPerOrder = 10;

  private static readonly MENU_NEW_REQUEST = "Янги заявка";
  private static readonly MENU_ORDERS = "Заказлар";
  private static readonly MENU_FILES = "Расмлар";
  private static readonly MENU_DEBT = "Карздорлик";
  private static readonly MENU_APPROVAL = "Тасдиклаш";
  private static readonly MENU_CATALOG = "Каталог";
  private static readonly MENU_LOCATION = "Локация";

  private static readonly CATALOG_URL = "https://mebers.kord.uz/catalog";

  private get furnitureEnterpriseId(): number {
    return getTelegramEnterpriseFurniture();
  }

  private readonly newRequestWizardByChatId = new Map<
    number,
    NewRequestWizardState
  >();

  private readonly stageDisplayUzCyrl: Record<OrderStageType, string> = {
    [OrderStageType.TALABGOR]: "Талабгор",
    [OrderStageType.SCALING]: "Улчов",
    [OrderStageType.DRAWING]: "Чизма",
    [OrderStageType.PRICING]: "Нархлаш",
    [OrderStageType.DOGOVOR]: "Шартнома",
    [OrderStageType.TEXNOLOG]: "Технолог",
    [OrderStageType.CUTTING]: "Раскрой",
    [OrderStageType.IN_PRODUCTION]: "Ишлаб чикариш",
    [OrderStageType.STORE]: "Омбор",
    [OrderStageType.DELIVERY]: "Етказиб бериш",
    [OrderStageType.COMPLETED]: "Якунланган",
  };

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly referencesService: ReferencesService,
    private readonly furnitureOrdersService: FurnitureOrdersService,
    private readonly reportsService: ReportsService,
  ) {}

  onApplicationBootstrap() {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    if (this.handlersInitialized) return;
    if (!isBotEnabled(TelegramBotId.FURNITURE_CLIENT)) {
      this.logger.log("Telegram furniture client bot disabled by env");
      return;
    }

    const bot = this.telegramBotService.getBot(TelegramBotId.FURNITURE_CLIENT);
    if (!bot) {
      this.logger.warn("Furniture client bot is not initialized — handlers skipped");
      return;
    }

    bot.onText(/^\/?(start|help)$/i, async (msg) => {
      await this.safeReply(
        msg.chat.id,
        this.getHelpText(),
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    });

    bot.onText(/^Z$/i, async (msg) => {
      await this.handleOrdersCommand(msg);
    });

    bot.onText(/^S(\d{1,3})?$/i, async (msg, match) => {
      await this.handleFinanceCommand(msg, match?.[1]);
    });

    bot.on("message", async (msg) => {
      await this.handleUnknownCommand(msg);
    });

    bot.on("callback_query", async (query) => {
      await this.handleCallbackQuery(query);
    });

    this.handlersInitialized = true;
    this.logger.log("Telegram client command handlers initialized");
  }

  private getHelpText(): string {
    return [
      "🤖 <b>Команды бота</b>",
      "",
      "Пастдаги тугмалардан фойдаланинг ёки:",
      "🆕 <b>Янги заявка</b> — янги буюртма очиш",
      "📦 <b>Z</b> / <b>Заказлар</b> — сизнинг заказларингиз",
      "🖼 <b>Расмлар</b> — заказ бўйича файллар",
      "💰 <b>S</b> / <b>Карздорлик</b> — жорий карздорлик",
      "📊 <b>S10</b> — охирги 10 кундаги харакатлар",
      "🛒 <b>Каталог</b> — каталогга ўтиш",
      "📍 <b>Локация</b> — жойлашувни юбориш",
    ].join("\n");
  }

  private getMainMenuReplyMarkup(): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: [
        [
          { text: TelegramClientService.MENU_NEW_REQUEST },
          { text: TelegramClientService.MENU_ORDERS },
          { text: TelegramClientService.MENU_FILES },
        ],
        [
          { text: TelegramClientService.MENU_DEBT },
          { text: TelegramClientService.MENU_APPROVAL },
        ],
        [
          { text: TelegramClientService.MENU_CATALOG },
          { text: TelegramClientService.MENU_LOCATION, request_location: true },
        ],
      ],
      resize_keyboard: true,
    };
  }

  private withMainMenu(
    options?: TelegramBot.SendMessageOptions,
  ): TelegramBot.SendMessageOptions {
    return {
      ...options,
      reply_markup: this.getMainMenuReplyMarkup(),
    };
  }

  private async handleOrdersCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const client = await this.referencesService.findClientByTelegramId(
        String(chatId),
      );
      const orders = await this.furnitureOrdersService.findByClient(client.id, {
        excludeCompleted: true,
      });
      if (!orders.length) {
        await this.safeReply(
          chatId,
          "📭 <b>У вас пока нет заказов.</b>",
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return;
      }
      await this.sendOrdersPage(chatId, orders as any[], 0);
    } catch (error: any) {
      this.logger.warn(`Failed to process Z command: ${error?.message}`);
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Не удалось получить список заказов.")}`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    }
  }

  private async handleFinanceCommand(
    msg: TelegramBot.Message,
    daysRaw?: string,
  ) {
    const chatId = msg.chat.id;
    try {
      const client = await this.referencesService.findClientByTelegramId(
        String(chatId),
      );

      if (!daysRaw) {
        const debt = await this.reportsService.getClientDebt(
          client.id,
          client.enterpriseId ?? null,
        );
        await this.safeReply(
          chatId,
          [
            "💰 <b>Жорий карздорлик</b>",
            // `Счет: <code>${debt.schet}</code>`,
            `Сумма: <b>${debt.debt.toLocaleString("ru-RU")}</b>`,
            `Санаси: ${this.formatDateTime(debt.asOf)}`,
          ].join("\n"),
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return;
      }

      const days = Math.max(1, Number(daysRaw));
      const movements = await this.reportsService.getClientMovements(
        client.id,
        days,
        client.enterpriseId ?? null,
      );
      const list = movements.movements.slice(0, 15);

      if (!list.length) {
        await this.safeReply(
          chatId,
          `📭 <b>За ${movements.days} дн. движений не найдено.</b>`,
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return;
      }

      const lines = list.map(
        (item: any) =>
          `• ${this.formatDate(item.date)} | ${this.escapeHtml(item.documentType || "-")} | <b>${item.total.toLocaleString("ru-RU")}</b>`,
      );
      await this.safeReply(
        chatId,
        [
          `📊 <b>Движения по ${movements.schet} за ${movements.days} дн.</b>:`,
          ...lines,
        ].join("\n"),
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    } catch (error: any) {
      this.logger.warn(`Failed to process S command: ${error?.message}`);
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Не удалось получить финансовую информацию.")}`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    }
  }

  private async handleUnknownCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (this.newRequestWizardByChatId.has(chatId)) {
      if (msg.location) {
        this.newRequestWizardByChatId.delete(chatId);
        await this.handleLocationMessage(msg);
        return;
      }

      if (text && this.isReplyMenuLabel(text)) {
        if (text === TelegramClientService.MENU_NEW_REQUEST) {
          await this.startNewRequestWizard(msg);
          return;
        }
        this.newRequestWizardByChatId.delete(chatId);
        // дальше обработать нажатие меню
      } else {
        const consumed = await this.tryConsumeNewRequestWizard(msg);
        if (consumed) return;
        return;
      }
    }

    if (msg.location) {
      await this.handleLocationMessage(msg);
      return;
    }

    if (!text) return;

    const isKnownCommand =
      /^\/?(start|help)$/i.test(text) ||
      /^Z$/i.test(text) ||
      /^S(\d{1,3})?$/i.test(text);

    if (isKnownCommand) return;

    if (await this.tryHandleReplyMenu(msg, text)) return;

    await this.safeReply(
      msg.chat.id,
      this.getHelpText(),
      this.withMainMenu({ parse_mode: "HTML" }),
    );
  }

  private async tryHandleReplyMenu(
    msg: TelegramBot.Message,
    text: string,
  ): Promise<boolean> {
    if (text === TelegramClientService.MENU_ORDERS) {
      await this.handleOrdersCommand(msg);
      return true;
    }
    if (text === TelegramClientService.MENU_FILES) {
      await this.handleRasmlarCommand(msg);
      return true;
    }
    if (text === TelegramClientService.MENU_DEBT) {
      await this.handleFinanceCommand(msg, undefined);
      return true;
    }
    if (text === TelegramClientService.MENU_NEW_REQUEST) {
      await this.startNewRequestWizard(msg);
      return true;
    }
    if (text === TelegramClientService.MENU_APPROVAL) {
      await this.safeReply(
        msg.chat.id,
        "⏳ <b>Тасдиклаш</b> — тез орада мавжуд бўлади.",
        this.withMainMenu({ parse_mode: "HTML" }),
      );
      return true;
    }
    if (text === TelegramClientService.MENU_CATALOG) {
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
                  url: TelegramClientService.CATALOG_URL,
                },
              ],
            ],
          },
        },
      );
      return true;
    }
    return false;
  }

  private async handleLocationMessage(msg: TelegramBot.Message): Promise<void> {
    const loc = msg.location;
    if (!loc) return;

    const chatId = msg.chat.id;
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    const latStr = lat.toFixed(5);
    const lonStr = lon.toFixed(5);

    this.logger.log(`Client location chatId=${chatId} lat=${latStr} lon=${lonStr}`);

    try {
      const client = await this.referencesService.findClientByTelegramId(
        String(chatId),
      );
      await this.referencesService.updateClientLocationByReferenceId(
        client.id,
        lat,
        lon,
      );
      await this.safeReply(
        chatId,
        [
          "📍 <b>Локация қабул қилинди ва сақланди</b>",
          `Координаталар: <code>${latStr}</code>, <code>${lonStr}</code>`,
        ].join("\n"),
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to save client location chatId=${chatId}: ${error?.message}`,
      );
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Локацияни сақлаб булмади.")}`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    }
  }

  private async handleRasmlarCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const client = await this.referencesService.findClientByTelegramId(
        String(chatId),
      );
      const orders = await this.furnitureOrdersService.findByClient(client.id);
      if (!orders.length) {
        await this.safeReply(
          chatId,
          "📭 <b>У вас пока нет заказов.</b>",
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return;
      }
      await this.sendRasmlarOrdersPage(chatId, orders as any[], 0);
    } catch (error: any) {
      this.logger.warn(`Failed to process Rasmlar command: ${error?.message}`);
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Не удалось получить список заказов.")}`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    }
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    const callbackData = query.data || "";
    if (
      !callbackData.startsWith("order:") &&
      !callbackData.startsWith("orders_page:") &&
      !callbackData.startsWith("order_files:") &&
      !callbackData.startsWith("rasmlar_orders_page:") &&
      !callbackData.startsWith("rasmlar_order:")
    ) {
      return;
    }

    const chatId = query.message?.chat.id;
    if (!chatId) return;

    try {
      const client = await this.referencesService.findClientByTelegramId(
        String(chatId),
      );

      if (callbackData.startsWith("orders_page:")) {
        const orders = (await this.furnitureOrdersService.findByClient(
          client.id,
          { excludeCompleted: true },
        )) as any[];
        const page = Number(callbackData.split(":")[1]);
        if (!Number.isFinite(page)) return;
        await this.sendOrdersPage(chatId, orders, page);
        return;
      }

      if (callbackData.startsWith("rasmlar_orders_page:")) {
        const orders = (await this.furnitureOrdersService.findByClient(
          client.id,
        )) as any[];
        const page = Number(callbackData.split(":")[1]);
        if (!Number.isFinite(page)) return;
        await this.sendRasmlarOrdersPage(chatId, orders, page);
        return;
      }

      const orderId = Number(callbackData.split(":")[1]);
      if (!Number.isFinite(orderId)) {
        await this.safeReply(
          chatId,
          "⚠️ <b>Неверный номер заказа.</b>",
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return;
      }

      const order = await this.furnitureOrdersService.findOneForClient(
        orderId,
        client.id,
      );

      if (callbackData.startsWith("order_files:")) {
        await this.sendOrderFiles(chatId, order as any);
        return;
      }

      if (callbackData.startsWith("rasmlar_order:")) {
        await this.sendOrderFiles(chatId, order as any);
        return;
      }

      if (!callbackData.startsWith("order:")) {
        return;
      }

      const stageHistory = ((order as any).stageHistory || [])
        .filter((item: any) => item.eventType === OrderHistoryEventType.STAGE)
        .sort((a: any, b: any) => Number(b.changedAt) - Number(a.changedAt))
        .slice(0, 5);

      const historyLines = stageHistory.length
        ? stageHistory.map(
            (item: any) =>
              `${this.formatDateTime(item.changedAt)}: ${this.escapeHtml(this.getStageDisplayName(item.fromStage))} -> ${this.escapeHtml(this.getStageDisplayName(item.toStage))}${item.comment ? ` (${this.escapeHtml(item.comment)})` : ""}`,
          )
        : ["Булимларда харакати йук"];

      const message = [
        `📦 <b>Заказ №${this.escapeHtml(String((order as any).orderNumber || (order as any).id))}</b>`,
        `Шартнома санаси: <b>${this.formatDate((order as any).orderDate || (order as any).createdDate)}</b>`,
        `Топшириш санаси: <b>${this.formatDate((order as any).deadlineDate)}</b>`,
        `Махсулот: <b>${this.escapeHtml(String((order as any).analitic?.name || "-"))}</b>`,
        `Киймати: <b>${this.formatMoney((order as any).total)}</b>`,
        `Неча кун колди: <b>${this.getDaysUntilDeadlineText((order as any).deadlineDate)}</b>`,
        `Жорий холати: <b>${this.escapeHtml(this.getStageDisplayName((order as any).currentStage))}</b>`,
        "",
        "🧾 <b>Булимларда харакати:</b>",
        ...historyLines,
      ].join("\n");

      await this.safeReply(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📎 Файллар", callback_data: `order_files:${orderId}` }],
          ],
        },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to process order callback: ${error?.message}`);
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Не удалось открыть заказ.")}`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    } finally {
      const bot = this.telegramBotService.getBot(TelegramBotId.FURNITURE_CLIENT);
      if (bot && query.id) {
        try {
          await bot.answerCallbackQuery(query.id);
        } catch (_) {}
      }
    }
  }

  private async safeReply(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions,
  ) {
    try {
      await this.telegramBotService.sendMessage(
        chatId,
        text,
        options,
        TelegramBotId.FURNITURE_CLIENT,
      );
    } catch (error: any) {
      this.logger.error(`Telegram send failed: ${error?.message}`);
    }
  }

  private formatDate(timestamp?: number | null): string {
    if (!timestamp) return "-";
    return new Date(Number(timestamp)).toLocaleDateString("ru-RU");
  }

  private formatDateTime(timestamp?: number | null): string {
    if (!timestamp) return "-";
    return new Date(Number(timestamp)).toLocaleString("ru-RU");
  }

  private formatMoney(value?: number | null): string {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
      return "-";
    }
    return Number(value).toLocaleString("ru-RU");
  }

  private getStageDisplayName(stage?: string | null): string {
    if (!stage) return "-";
    const normalizedStage = normalizeOrderStage(stage);
    return normalizedStage ? this.stageDisplayUzCyrl[normalizedStage] : stage;
  }

  private async sendOrderFiles(chatId: number, order: any): Promise<void> {
    const files = this.extractClientVisibleFiles(order).slice(
      0,
      this.maxFilesPerOrder,
    );
    if (!files.length) {
      await this.safeReply(
        chatId,
        "📭 <b>Бу заказ учун мижозга очик файллар йук.</b>",
        this.withMainMenu({ parse_mode: "HTML" }),
      );
      return;
    }

    await this.safeReply(
      chatId,
      `📎 <b>Заказ №${this.escapeHtml(String(order?.orderNumber || order?.id || "-"))}</b>\nФайллар юборилмокда (${files.length} та)...`,
      { parse_mode: "HTML" },
    );

    let sentCount = 0;
    for (const file of files) {
      const documentInput = this.resolveDocumentInput(file.url);
      if (!documentInput) {
        this.logger.warn(
          `Skipping file: cannot resolve source for ${file.url}`,
        );
        continue;
      }
      try {
        await this.telegramBotService.sendDocument(chatId, documentInput, {
          caption: `${file.stageLabel}${file.name ? ` | ${file.name}` : ""}`,
        });
        sentCount += 1;
      } catch (error: any) {
        this.logger.warn(
          `Failed to send order file (${file.url}): ${error?.message}`,
        );
      }
    }

    if (!sentCount) {
      await this.safeReply(
        chatId,
        "⚠️ <b>Файлларни юбориб булмади.</b>",
        this.withMainMenu({ parse_mode: "HTML" }),
      );
      return;
    }

    if (files.length > sentCount) {
      await this.safeReply(
        chatId,
        `✅ <b>Юборилди:</b> ${sentCount} / ${files.length} файл.`,
        this.withMainMenu({ parse_mode: "HTML" }),
      );
    }
  }

  private extractClientVisibleFiles(
    order: any,
  ): Array<{ url: string; name: string; stageLabel: string }> {
    const byStage = [
      {
        stageLabel: this.getStageDisplayName(OrderStageType.SCALING),
        raw: order?.filesFromScaling,
      },
      {
        stageLabel: this.getStageDisplayName(OrderStageType.DRAWING),
        raw: order?.filesFromDrawing,
      },
      {
        stageLabel: this.getStageDisplayName(OrderStageType.STORE),
        raw: order?.filesFromStore,
      },
      {
        stageLabel: this.getStageDisplayName(OrderStageType.DELIVERY),
        raw: order?.filesFromDelivery,
      },
    ];

    const allFiles = byStage.flatMap((item) =>
      this.parseStageFiles(item.raw, item.stageLabel),
    );
    const fromTmz = this.filesFromTmzAnalitic(order);
    const merged = [...allFiles, ...fromTmz];
    const seen = new Set<string>();
    return merged.filter((file) => {
      if (seen.has(file.url)) return false;
      seen.add(file.url);
      return true;
    });
  }

  /** Файлы SCALING/DRAWING из карточки готовой продукции (analitic.refValues), если заданы. */
  private filesFromTmzAnalitic(
    order: any,
  ): Array<{ url: string; name: string; stageLabel: string }> {
    const rv = order?.analitic?.refValues;
    if (!rv) return [];
    const scaling = this.parseTmzFilesForClient(
      (rv as any).filesFromScaling,
      this.getStageDisplayName(OrderStageType.SCALING),
    );
    const drawing = this.parseTmzFilesForClient(
      (rv as any).filesFromDrawing,
      this.getStageDisplayName(OrderStageType.DRAWING),
    );
    return [...scaling, ...drawing];
  }

  /** Поддержка JSONB: массив строк (URL) или объектов как в заявке. */
  private parseTmzFilesForClient(
    raw: unknown,
    stageLabel: string,
  ): Array<{ url: string; name: string; stageLabel: string }> {
    if (!raw) return [];
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    const out: Array<{ url: string; name: string; stageLabel: string }> = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.trim()) {
        out.push({
          url: item.trim(),
          name: item.split("/").pop() || item,
          stageLabel,
        });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      const visibleToClient =
        value.visibleToClient === undefined ||
        value.visibleToClient === true ||
        value.visibleToClient === "true";
      if (!visibleToClient) continue;
      const urlRaw = value.url;
      if (typeof urlRaw !== "string" || !urlRaw.trim()) continue;
      const originalName =
        typeof value.originalName === "string"
          ? value.originalName
          : typeof value.originalname === "string"
            ? value.originalname
            : "";
      out.push({
        url: urlRaw.trim(),
        name: originalName,
        stageLabel,
      });
    }
    return out;
  }

  private parseStageFiles(
    raw: unknown,
    stageLabel: string,
  ): Array<{ url: string; name: string; stageLabel: string }> {
    if (!raw) return [];
    let parsed: unknown = raw;

    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): { url: string; name: string; stageLabel: string } | null => {
        // Legacy format: array of URL strings should not be exposed to clients.
        if (typeof item === "string") return null;
        if (!item || typeof item !== "object") return null;

        const value = item as Record<string, unknown>;
        const visibleToClient =
          value.visibleToClient === true || value.visibleToClient === "true";
        if (!visibleToClient) return null;

        const urlRaw = value.url;
        if (typeof urlRaw !== "string" || !urlRaw.trim()) return null;

        const originalName =
          typeof value.originalName === "string"
            ? value.originalName
            : typeof value.originalname === "string"
              ? value.originalname
              : "";

        return {
          url: urlRaw.trim(),
          name: originalName,
          stageLabel,
        };
      })
      .filter(
        (item): item is { url: string; name: string; stageLabel: string } =>
          Boolean(item),
      );
  }

  private toAbsoluteUrl(url: string): string | null {
    if (/^https?:\/\//i.test(url)) return url;
    const baseUrl = (process.env.SERVER_URL || "").replace(/\/+$/, "");
    if (!baseUrl) return null;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }

  private resolveDocumentInput(url: string): string | null {
    if (!url?.trim()) return null;
    if (/^https?:\/\//i.test(url)) return url;

    const normalizedUrl = url.trim();
    if (normalizedUrl.startsWith("/api/upload/furniture-order-file/")) {
      const filename = normalizedUrl.split("/").pop();
      if (!filename) return null;
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return null;
      }
      return join(process.cwd(), "uploads", "furniture-orders", filename);
    }

    return this.toAbsoluteUrl(normalizedUrl);
  }

  private getDaysUntilDeadlineText(deadlineTimestamp?: number | null): string {
    if (!deadlineTimestamp) return "-";
    const msInDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diffMs = Number(deadlineTimestamp) - now;
    const diffDays = Math.ceil(diffMs / msInDay);

    if (diffDays > 0) return `${diffDays}`;
    if (diffDays === 0) return "0 (сегодня)";
    return `${Math.abs(diffDays)} (просрочен)`;
  }

  private async sendOrdersPage(
    chatId: number,
    orders: any[],
    page: number,
  ): Promise<void> {
    const totalPages = Math.max(
      1,
      Math.ceil(orders.length / this.ordersPageSize),
    );
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * this.ordersPageSize;
    const pageOrders = orders.slice(start, start + this.ordersPageSize);

    const orderButtons = pageOrders.map((order: any) => {
      const labelDate = this.formatDate(order.orderDate || order.createdDate);
      const productNameRaw = String(order?.analitic?.name || "-");
      const productName =
        productNameRaw.length > 20
          ? `${productNameRaw.slice(0, 20)}...`
          : productNameRaw;
      return [
        {
          text: `№${order.orderNumber || order.id} | ${labelDate} | ${productName}`,
          callback_data: `order:${order.id}`,
        },
      ];
    });

    const navRow: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      navRow.push({
        text: "⬅️ Ортга",
        callback_data: `orders_page:${safePage - 1}`,
      });
    }
    if (safePage < totalPages - 1) {
      navRow.push({
        text: "Олдинга ➡️",
        callback_data: `orders_page:${safePage + 1}`,
      });
    }

    const keyboard = navRow.length ? [...orderButtons, navRow] : orderButtons;
    const title = [
      "📦 <b>Сизнинг заказларингиз</b>",
      `Саҳифа <b>${safePage + 1}</b> / <b>${totalPages}</b>`,
      "Куриш учун заказни танланг.",
    ].join("\n");

    await this.safeReply(chatId, title, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async sendRasmlarOrdersPage(
    chatId: number,
    orders: any[],
    page: number,
  ): Promise<void> {
    const totalPages = Math.max(
      1,
      Math.ceil(orders.length / this.ordersPageSize),
    );
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * this.ordersPageSize;
    const pageOrders = orders.slice(start, start + this.ordersPageSize);

    const orderButtons = pageOrders.map((order: any) => {
      const labelDate = this.formatDate(order.orderDate || order.createdDate);
      const productNameRaw = String(order?.analitic?.name || "-");
      const productName =
        productNameRaw.length > 20
          ? `${productNameRaw.slice(0, 20)}...`
          : productNameRaw;
      return [
        {
          text: `№${order.orderNumber || order.id} | ${labelDate} | ${productName}`,
          callback_data: `rasmlar_order:${order.id}`,
        },
      ];
    });

    const navRow: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      navRow.push({
        text: "⬅️ Ортга",
        callback_data: `rasmlar_orders_page:${safePage - 1}`,
      });
    }
    if (safePage < totalPages - 1) {
      navRow.push({
        text: "Олдинга ➡️",
        callback_data: `rasmlar_orders_page:${safePage + 1}`,
      });
    }

    const keyboard = navRow.length ? [...orderButtons, navRow] : orderButtons;
    const title = [
      "🖼 <b>Расмлар</b> — заказ бўйича файллар",
      `Саҳифа <b>${safePage + 1}</b> / <b>${totalPages}</b>`,
      "Файлларни олиш учун заказни танланг.",
    ].join("\n");

    await this.safeReply(chatId, title, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private isReplyMenuLabel(text: string): boolean {
    const labels = new Set([
      TelegramClientService.MENU_NEW_REQUEST,
      TelegramClientService.MENU_ORDERS,
      TelegramClientService.MENU_FILES,
      TelegramClientService.MENU_DEBT,
      TelegramClientService.MENU_APPROVAL,
      TelegramClientService.MENU_CATALOG,
      TelegramClientService.MENU_LOCATION,
    ]);
    return labels.has(text);
  }

  private async startNewRequestWizard(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    try {
      const existing = await this.referencesService.findClientByTelegramIdOrNull(
        String(chatId),
      );

      if (existing) {
        const phoneRaw = String(
          (existing as { refValues?: { phone?: string | null } }).refValues
            ?.phone ?? "",
        ).trim();
        const hadPhoneInDb = phoneRaw.length > 0;
        const displayName = String(existing.name || "").trim() || "Мижоз";

        this.newRequestWizardByChatId.set(chatId, {
          step: "furniture",
          displayName,
          existingClientId: existing.id,
          hadPhoneInDb,
          savedPhoneFromDb: hadPhoneInDb ? phoneRaw : undefined,
        });

        const intro = hadPhoneInDb
          ? [
              "📝 <b>Янги заявка</b>",
              "",
              `Салом, <b>${this.escapeHtml(displayName)}</b>!`,
              "",
              "Қандай <b>мебель</b> буюртма қилмоқчисиз? (қисқа тавсиф)",
            ]
          : [
              "📝 <b>Янги заявка</b>",
              "",
              `Салом, <b>${this.escapeHtml(displayName)}</b>!`,
              "",
              "Базада телефон рақамингиз йўқ — кейинрок сўраймиз.",
              "",
              "Қандай <b>мебель</b> буюртма қилмоқчисиз? (қисқа тавсиф)",
            ];

        await this.safeReply(chatId, intro.join("\n"), {
          parse_mode: "HTML",
          reply_markup: this.getMainMenuReplyMarkup(),
        });
        return;
      }
    } catch (e: any) {
      this.logger.warn(
        `startNewRequestWizard lookup failed chatId=${chatId}: ${e?.message}`,
      );
    }

    this.newRequestWizardByChatId.set(chatId, { step: "name" });
    await this.safeReply(
      chatId,
      [
        "📝 <b>Янги заявка</b>",
        "",
        "Илтимос, <b>исмингизни</b> ёзинг (матн хабар сифатида).",
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: this.getMainMenuReplyMarkup(),
      },
    );
  }

  private getContactRequestKeyboard(): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: [
        [{ text: "Телефон рақамини юбориш", request_contact: true }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }

  private getNewRequestOrderStages(): OrderStageType[] {
    const raw = process.env.TELEGRAM_CLIENT_ORDER_STAGES?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const stages = parsed
            .map((s) => normalizeOrderStage(String(s)))
            .filter((s): s is OrderStageType => Boolean(s));
          if (stages.length) return stages;
        }
      } catch (e: any) {
        this.logger.warn(
          `TELEGRAM_CLIENT_ORDER_STAGES parse failed: ${e?.message}`,
        );
      }
    }
    return [
      OrderStageType.TALABGOR,
      OrderStageType.SCALING,
      OrderStageType.DRAWING,
      OrderStageType.PRICING,
      OrderStageType.DOGOVOR,
      OrderStageType.TEXNOLOG,
      OrderStageType.CUTTING,
      OrderStageType.IN_PRODUCTION,
      OrderStageType.STORE,
      OrderStageType.DELIVERY,
    ];
  }

  private buildNewRequestOrderComment(params: {
    displayName: string;
    furniture: string;
    phone: string;
    chatId: number;
    username?: string;
  }): string {
    const lines = [
      "Янги заявка (Telegram)",
      `Исм: ${params.displayName}`,
      `Мебель: ${params.furniture}`,
      `Телефон: ${params.phone}`,
    ];
    if (params.username) {
      lines.push(`Telegram: @${params.username}`);
    }
    lines.push(`Chat ID: ${params.chatId}`);
    return lines.join("\n");
  }

  private normalizeManualPhoneInput(text: string): string | null {
    const t = text.replace(/\s/g, "");
    if (!t) return null;
    const digits = t.replace(/\D/g, "");
    if (digits.length < 9) return null;
    if (t.startsWith("+")) return `+${digits}`;
    return digits.startsWith("998") || digits.length >= 9 ? `+${digits}` : null;
  }

  private async tryConsumeNewRequestWizard(
    msg: TelegramBot.Message,
  ): Promise<boolean> {
    const chatId = msg.chat.id;
    const state = this.newRequestWizardByChatId.get(chatId);
    if (!state) return false;

    const text = (msg.text || "").trim();

    if (state.step === "phone" && msg.contact) {
      const fromId = msg.from?.id;
      if (
        msg.contact.user_id != null &&
        fromId != null &&
        Number(msg.contact.user_id) !== Number(fromId)
      ) {
        await this.safeReply(
          chatId,
          "⚠️ <b>Фақат ўзингизнинг контактингизни юборинг.</b>",
          { parse_mode: "HTML", reply_markup: this.getContactRequestKeyboard() },
        );
        return true;
      }
      const phoneRaw = msg.contact.phone_number || "";
      const phone = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
      await this.finishNewRequestWizard(msg, state, phone);
      return true;
    }

    if (state.step === "phone" && text) {
      const manual = this.normalizeManualPhoneInput(text);
      if (manual) {
        await this.finishNewRequestWizard(msg, state, manual);
        return true;
      }
      await this.safeReply(
        chatId,
        "⚠️ <b>Телефон нотўғри.</b> Тугма орқали контакт юборинг ёки рақамни +998... шаклида ёзинг.",
        { parse_mode: "HTML", reply_markup: this.getContactRequestKeyboard() },
      );
      return true;
    }

    if (state.step === "furniture" && !text && msg.contact) {
      await this.safeReply(
        chatId,
        "⚠️ <b>Мебель турини матн хабар сифатида ёзинг</b> (контакт эмас).",
        { parse_mode: "HTML", reply_markup: this.getMainMenuReplyMarkup() },
      );
      return true;
    }

    if (!text) {
      if (msg.contact) {
        await this.safeReply(
          chatId,
          "⚠️ <b>Аввал исм ва мебел турини ёзинг.</b> Қадамларни тартибда бажаринг.",
          this.withMainMenu({ parse_mode: "HTML" }),
        );
        return true;
      }
      return false;
    }

    if (state.step === "name") {
      this.newRequestWizardByChatId.set(chatId, {
        step: "furniture",
        displayName: text,
      });
      await this.safeReply(
        chatId,
        [
          "✅ <b>Раҳмат.</b>",
          "",
          "Қандай <b>мебель</b> буюртма қилмоқчисиз? (қисқа тавсиф)",
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: this.getMainMenuReplyMarkup(),
        },
      );
      return true;
    }

    if (state.step === "furniture") {
      const merged: NewRequestWizardState = {
        ...state,
        furniture: text,
      };
      if (
        merged.existingClientId &&
        merged.hadPhoneInDb &&
        (merged.savedPhoneFromDb || "").trim().length > 0
      ) {
        await this.finishNewRequestWizard(
          msg,
          merged,
          (merged.savedPhoneFromDb || "").trim(),
        );
        return true;
      }

      this.newRequestWizardByChatId.set(chatId, {
        ...merged,
        step: "phone",
      });
      await this.safeReply(
        chatId,
        [
          "✅ <b>Яхши.</b>",
          "",
          "Охирги қадам: <b>телефон рақамингиз</b>.",
          "Пастдаги тугма орқали контактни юборинг.",
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: this.getContactRequestKeyboard(),
        },
      );
      return true;
    }

    return false;
  }

  private async finishNewRequestWizard(
    msg: TelegramBot.Message,
    state: NewRequestWizardState,
    phone: string,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const displayName = (state.displayName || "").trim();
    const furniture = (state.furniture || "").trim();
    if (!displayName || !furniture) {
      this.newRequestWizardByChatId.delete(chatId);
      await this.safeReply(
        chatId,
        "⚠️ <b>Сеанс бузилди.</b> «Янги заявка»ни қайта босинг.",
        { parse_mode: "HTML", reply_markup: this.getMainMenuReplyMarkup() },
      );
      return;
    }

    const telegramId = String(chatId);
    const comment = this.buildNewRequestOrderComment({
      displayName,
      furniture,
      phone,
      chatId,
      username: msg.from?.username,
    });

    try {
      let clientId: number;

      if (state.existingClientId) {
        clientId = state.existingClientId;
        if (!state.hadPhoneInDb && phone.trim()) {
          await this.referencesService.updateClientPhoneByReferenceId(
            clientId,
            phone.trim(),
          );
        }
      } else {
        const client = await this.createTelegramLeadClient(
          displayName,
          telegramId,
          phone,
        );
        clientId = client.id;
      }

      const order = await this.furnitureOrdersService.create({
        enterpriseId: this.furnitureEnterpriseId,
        clientId,
        createdDate: Date.now(),
        comment,
        orderType: "individualPrice",
        stages: this.getNewRequestOrderStages(),
        productionDeptIds: [],
      } as any);

      this.newRequestWizardByChatId.delete(chatId);
      await this.safeReply(
        chatId,
        [
          "✅ <b>Заявка қабул қилинди.</b>",
          `Заказ №<b>${this.escapeHtml(String((order as any).orderNumber || (order as any).id))}</b>`,
          "",
          "Жавоб учун операторларимиз тез орада алоқага чиқади.",
        ].join("\n"),
        { parse_mode: "HTML", reply_markup: this.getMainMenuReplyMarkup() },
      );
    } catch (error: any) {
      this.logger.error(
        `finishNewRequestWizard failed chatId=${chatId}: ${error?.message}`,
      );
      this.newRequestWizardByChatId.delete(chatId);
      await this.safeReply(
        chatId,
        `⚠️ ${this.escapeHtml(error?.message || "Заявкани сақлаб булмади.")}`,
        { parse_mode: "HTML", reply_markup: this.getMainMenuReplyMarkup() },
      );
    }
  }

  private async createTelegramLeadClient(
    displayName: string,
    telegramId: string,
    phone: string,
  ) {
    const baseName = displayName.slice(0, 200) || `Telegram ${telegramId}`;
    let attemptName = baseName;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const dto: UpdateCreateReferenceDto = {
        name: attemptName,
        typeReference: TypeReference.PARTNERS,
        enterpriseId: this.furnitureEnterpriseId,
        isFolder: false,
        refValues: {
          typePartners: TypePartners.CLIENTS,
          telegramId,
          phone,
        },
      };

      try {
        return await this.referencesService.createReference(dto);
      } catch (e: any) {
        const status =
          e instanceof HttpException ? e.getStatus() : Number(e?.status);
        if (status === HttpStatus.CONFLICT && attempt < 7) {
          attemptName =
            attempt === 0
              ? `${baseName} (TG ${telegramId})`
              : `${baseName} (TG ${telegramId} #${attempt + 1})`;
          continue;
        }
        throw e;
      }
    }

    throw new Error("Не удалось создать клиента после нескольких попыток");
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
