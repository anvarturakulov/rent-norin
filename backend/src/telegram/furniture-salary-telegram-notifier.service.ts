import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { Document } from "src/documents/document.model";
import { DocumentType } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { EntryCreationAttrs } from "src/entries/entry.model";
import { ReferencesService } from "src/references/references.service";
import { TelegramBotId } from "./telegram-bot-id";
import { TelegramBotService } from "./telegram-bot.service";
import {
  escapeTelegramHtml,
  formatMoneyRu,
  formatWorkerSalaryBalanceLine,
} from "./telegram-html.util";
import { WorkerSalaryAccountService } from "./worker-salary-account.service";

type SalaryNotifyAction = "posted" | "cancelled";

interface WorkerSalaryEvent {
  workerId: number;
  amount: number;
  kind: "accrual" | "payment";
  sectionName: string;
  comment: string;
}

@Injectable()
export class FurnitureSalaryTelegramNotifierService {
  private readonly logger = new Logger(
    FurnitureSalaryTelegramNotifierService.name,
  );

  constructor(
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
    private readonly telegramBotService: TelegramBotService,
    private readonly workerSalaryAccountService: WorkerSalaryAccountService,
  ) {}

  async notifyAfterDocumentPosted(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): Promise<void> {
    await this.notify(doc, entries, "posted");
  }

  async notifyAfterDocumentCancelled(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): Promise<void> {
    await this.notify(doc, entries, "cancelled");
  }

  private async notify(
    doc: Document,
    entries: EntryCreationAttrs[],
    action: SalaryNotifyAction,
  ): Promise<void> {
    if (!entries?.length) return;
    if (!this.shouldNotifyDocument(doc)) return;

    const events = this.extractWorkerEvents(doc, entries);
    if (!events.length) return;

    for (const event of events) {
      await this.sendWorkerNotification(doc, event, action);
    }
  }

  private shouldNotifyDocument(doc: Document): boolean {
    if (doc.documentType === DocumentType.ZpCalculate) return true;
    if (
      doc.documentType === DocumentType.LeaveCash &&
      doc.docValues?.isWorker
    ) {
      return true;
    }
    return false;
  }

  private extractWorkerEvents(
    doc: Document,
    entries: EntryCreationAttrs[],
  ): WorkerSalaryEvent[] {
    const events: WorkerSalaryEvent[] = [];

    for (const entry of entries) {
      if (
        doc.documentType === DocumentType.LeaveCash &&
        doc.docValues?.isWorker &&
        entry.debet === Schet.S67 &&
        entry.debetFirstSubcontoId &&
        Number(entry.total) > 0
      ) {
        events.push({
          workerId: Number(entry.debetFirstSubcontoId),
          amount: Number(entry.total),
          kind: "payment",
          sectionName: "",
          comment: String(entry.description || "").trim(),
        });
        continue;
      }

      if (
        doc.documentType === DocumentType.ZpCalculate &&
        entry.kredit === Schet.S67 &&
        entry.kreditFirstSubcontoId &&
        Number(entry.total) > 0
      ) {
        events.push({
          workerId: Number(entry.kreditFirstSubcontoId),
          amount: Number(entry.total),
          kind: "accrual",
          sectionName: "",
          comment: String(entry.description || "").trim(),
        });
      }
    }

    return events;
  }

  private async sendWorkerNotification(
    doc: Document,
    event: WorkerSalaryEvent,
    action: SalaryNotifyAction,
  ): Promise<void> {
    try {
      const workerRef = await this.referencesService
        .getReferenceById(event.workerId)
        .catch(() => null);
      const telegramId = workerRef?.refValues?.telegramId?.trim();
      if (!telegramId) {
        this.logger.warn(
          `Skip salary notify: worker ${event.workerId} has no telegramId`,
        );
        return;
      }

      const enterpriseId =
        workerRef?.enterpriseId ??
        doc.enterpriseId ??
        doc.targetEnterpriseId ??
        null;
      if (enterpriseId == null) {
        this.logger.warn(
          `Skip salary notify: enterpriseId unknown for worker ${event.workerId}`,
        );
        return;
      }

      const sectionName = await this.resolveSectionName(doc, event);
      const comment =
        event.comment || String(doc.docValues?.comment || "").trim();
      const balance = await this.workerSalaryAccountService.getS67Balance(
        event.workerId,
        Number(enterpriseId),
      );

      const title =
        action === "cancelled"
          ? "❌ <b>Бекор қилинди</b>"
          : event.kind === "accrual"
            ? "✅ <b>Иш ҳақи хисобланди</b>"
            : "💰 <b>Иш хаки туланди</b>";

      const detailLine =
        event.kind === "accrual"
          ? `Булим: <b>${escapeTelegramHtml(sectionName || "—")}</b>`
          : `Касса: <b>${escapeTelegramHtml(sectionName || "—")}</b>`;

      const text = [
        title,
        `Ходим: <b>${escapeTelegramHtml(workerRef?.name || "—")}</b>`,
        `Сумма: <b>${formatMoneyRu(event.amount)}</b> сум`,
        detailLine,
        comment ? `Изох: <b>${escapeTelegramHtml(comment)}</b>` : null,
        `Хужжат: <b>#${doc.id}</b>`,
        formatWorkerSalaryBalanceLine(balance, "сум"),
      ]
        .filter(Boolean)
        .join("\n");

      await this.telegramBotService.sendMessage(
        telegramId,
        text,
        { parse_mode: "HTML" },
        TelegramBotId.FURNITURE_SALARY,
      );
    } catch (error: any) {
      this.logger.warn(`Salary notify failed: ${error?.message}`);
    }
  }

  private async resolveSectionName(
    doc: Document,
    event: WorkerSalaryEvent,
  ): Promise<string> {
    if (event.kind === "accrual") {
      const receiverId = doc.docValues?.receiverId;
      if (!receiverId) return "";
      const ref = await this.referencesService
        .getReferenceById(receiverId)
        .catch(() => null);
      return ref?.name || "";
    }

    const senderId = doc.docValues?.senderId;
    if (!senderId) return "";
    const ref = await this.referencesService
      .getReferenceById(senderId)
      .catch(() => null);
    return ref?.name || "";
  }
}
