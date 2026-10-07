import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { Document } from "src/documents/document.model";
import { DocumentType } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { ReferencesService } from "src/references/references.service";
import { partnerHasMediatorRole } from "src/documents/helper/mediatorBonus.helper";
import { TelegramBotService } from "./telegram-bot.service";
import { TelegramBotId } from "./telegram-bot-id";

@Injectable()
export class MediatorTelegramNotifierService {
  private readonly logger = new Logger(MediatorTelegramNotifierService.name);

  constructor(
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async notifyAfterDocumentPosted(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): Promise<void> {
    if (!entries?.length) return;

    if (doc.documentType === DocumentType.ReceiveToolsFromClient) {
      const accrual = entries.find((e) => e.kredit === Schet.S65);
      if (accrual?.kreditFirstSubcontoId && accrual.total > 0) {
        const partnerRef = await this.referencesService
          .getReferenceById(accrual.kreditFirstSubcontoId)
          .catch(() => null);
        await this.notifyAccrual({
          partnerId: accrual.kreditFirstSubcontoId,
          amount: accrual.total,
          partnerName: partnerRef?.name ?? "-",
          docId: Number(doc.id),
        });
      }
      return;
    }

    if (
      doc.documentType === DocumentType.LeaveCash &&
      doc.docValues?.isMediator
    ) {
      const payment = entries.find((e) => e.debet === Schet.S65);
      if (payment?.debetFirstSubcontoId && payment.total > 0) {
        const cashRef = doc.docValues?.senderId
          ? await this.referencesService
              .getReferenceById(doc.docValues.senderId)
              .catch(() => null)
          : null;
        await this.notifyPayment({
          partnerId: payment.debetFirstSubcontoId,
          amount: payment.total,
          cashStorageName: cashRef?.name ?? "-",
          docId: Number(doc.id),
        });
      }
    }
  }

  async notifyAccrual(params: {
    partnerId: number;
    amount: number;
    partnerName: string;
    docId: number;
  }): Promise<void> {
    try {
      const telegramId = await this.resolvePartnerTelegramId(params.partnerId);
      if (!telegramId) return;

      const text = [
        `🎁 <b>Бонус хисобланди</b>`,
        `Сумма: <b>${this.formatMoney(params.amount)}</b> сум`,
        `Хамкор: <b>${this.escapeHtml(params.partnerName)}</b>`,
        `Хужжат: <b>#${params.docId}</b>`,
      ].join("\n");

      await this.telegramBotService.sendMessage(
        telegramId,
        text,
        { parse_mode: "HTML" },
        TelegramBotId.RENTAL_MEDIATOR,
      );
    } catch (error: any) {
      this.logger.warn(`Mediator accrual notify failed: ${error?.message}`);
    }
  }

  async notifyPayment(params: {
    partnerId: number;
    amount: number;
    cashStorageName: string;
    docId: number;
  }): Promise<void> {
    try {
      const telegramId = await this.resolvePartnerTelegramId(params.partnerId);
      if (!telegramId) return;

      const text = [
        `💰 <b>Бонус туланди</b>`,
        `Сумма: <b>${this.formatMoney(params.amount)}</b> so'm`,
        `Касса: <b>${this.escapeHtml(params.cashStorageName)}</b>`,
        `Хужжат: <b>#${params.docId}</b>`,
      ].join("\n");

      await this.telegramBotService.sendMessage(
        telegramId,
        text,
        { parse_mode: "HTML" },
        TelegramBotId.RENTAL_MEDIATOR,
      );
    } catch (error: any) {
      this.logger.warn(`Mediator payment notify failed: ${error?.message}`);
    }
  }

  private async resolvePartnerTelegramId(
    partnerId: number,
  ): Promise<string | null> {
    const ref = await this.referencesService.getReferenceById(partnerId);
    if (!partnerHasMediatorRole(ref?.refValues)) {
      this.logger.warn(
        `Skip mediator notify: partner ${partnerId} has no driver/master role`,
      );
      return null;
    }
    const telegramId = ref?.refValues?.telegramId?.trim();
    return telegramId || null;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

