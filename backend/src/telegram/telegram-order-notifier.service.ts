import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import {
  normalizeOrderStage,
  OrderStageType,
} from "src/interfaces/furniture-order.interface";
import { RefValues } from "src/refvalues/refValues.model";
import { Reference } from "src/references/reference.model";
import { ReferencesService } from "src/references/references.service";
import { TelegramBotService } from "./telegram-bot.service";
import { TelegramBotId } from "./telegram-bot-id";

@Injectable()
export class TelegramOrderNotifierService {
  private readonly logger = new Logger(TelegramOrderNotifierService.name);
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
    @InjectModel(FurnitureOrder)
    private readonly orderRepo: typeof FurnitureOrder,
    private readonly referencesService: ReferencesService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async notifyStageChanged(params: {
    orderId: number;
    fromStage?: string | null;
    toStage?: string | null;
    changedAt: number;
    comment?: string;
  }): Promise<void> {
    try {
      const order = await this.orderRepo.findByPk(params.orderId, {
        include: [
          {
            model: Reference,
            as: "client",
            include: [{ model: RefValues }],
          },
          {
            model: Reference,
            as: "analitic",
            include: [{ model: RefValues }],
          },
        ],
      });
      if (!order) return;

      const clientId = Number((order as any).clientId);
      if (!clientId) return;

      const telegramId =
        await this.referencesService.getClientTelegramIdByPartnerId(clientId);
      if (!telegramId) return;

      const orderNumber = String(
        (order as any).orderNumber || (order as any).id,
      );
      const clientName = this.resolveReferenceName((order as any).client);
      const productName = this.resolveReferenceName((order as any).analitic);
      const total = this.formatMoney((order as any).total);
      const orderDate = this.formatDate(
        (order as any).orderDate || (order as any).createdDate,
      );
      const deadlineDate = this.formatDate((order as any).deadlineDate);
      const fromStage = this.getStageDisplayName(params.fromStage);
      const toStage = this.getStageDisplayName(params.toStage);
      const currentStage = this.getStageDisplayName(
        (order as any).currentStage,
      );

      const text = [
        `📣 <b>Заказ янги боскичга утди</b>`,
        // "<br/>",
        `Олдинги боскич: <b>${this.escapeHtml(fromStage)}</b>`,
        `Янги боскич: <b>${this.escapeHtml(toStage)}</b>`,
        `🧾 <b>Заказ маълумотлари</b>`,
        `Рақами: <b>№${this.escapeHtml(orderNumber)}</b>`,
        // `Мижоз: <b>${this.escapeHtml(clientName)}</b>`,
        `Махсулот: <b>${this.escapeHtml(productName)}</b>`,
        total !== "-" ? `Қиймати: <b>${this.escapeHtml(total)}</b>` : "",
        `Шартнома санаси: <b>${this.escapeHtml(orderDate)}</b>`,
        `Топшириш санаси: <b>${this.escapeHtml(deadlineDate)}</b>`,
        "",
        // `🔄`,
        // `Жорий холат: <b>${this.escapeHtml(currentStage)}</b>`,
        // `Сана ва вакт: <b>${this.escapeHtml(this.formatDateTime(params.changedAt))}</b>`,
        params.comment ? `Изох: <i>${this.escapeHtml(params.comment)}</i>` : "",
        "",
        `🙏 Ишончингиз учун рахмат. Заказингиз назоратимизда.`,
      ]
        .filter(Boolean)
        .join("\n");

      await this.telegramBotService.sendMessage(
        telegramId,
        text,
        { parse_mode: "HTML" },
        TelegramBotId.FURNITURE_CLIENT,
      );
    } catch (error: any) {
      this.logger.warn(`Failed to send stage notification: ${error?.message}`);
    }
  }

  private getStageDisplayName(stage?: string | null): string {
    if (!stage) return "-";
    const normalizedStage = normalizeOrderStage(stage);
    return normalizedStage ? this.stageDisplayUzCyrl[normalizedStage] : stage;
  }

  private resolveReferenceName(reference?: any): string {
    if (!reference) return "-";
    if (reference.name) return String(reference.name);
    const refValues = Array.isArray(reference.refValues)
      ? reference.refValues
      : [];
    const named = refValues.find((item: any) => item?.value);
    return named?.value ? String(named.value) : "-";
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
