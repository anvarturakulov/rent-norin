import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { parseNumberOrFallback } from "src/documents/helper/mediatorBonus.helper";
import { DocumentType } from "src/interfaces/document.interface";
import { ReferencesService } from "src/references/references.service";
import { TelegramBotId } from "./telegram-bot-id";
import { getTelegramEnterpriseRental } from "./telegram-env";
import { TelegramBotService } from "./telegram-bot.service";
import {
  escapeTelegramHtml,
  formatMoneyRu,
  formatTelegramPlainTable,
} from "./telegram-html.util";

const TOOLS_TABLE_THRESHOLD = 4;

interface ToolListItem {
  name: string;
  count: number;
  rentSum?: number;
}

interface PaymentBreakdown {
  cash: number;
  plastic: number;
  usd: number;
  usdRate: number;
  usdInSom: number;
  total: number;
}

@Injectable()
export class RentalClientTelegramNotifierService {
  private readonly logger = new Logger(RentalClientTelegramNotifierService.name);

  constructor(
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async notifyAfterDocumentPosted(doc: Document): Promise<void> {
    const enterpriseId = getTelegramEnterpriseRental();
    if (Number(doc.enterpriseId) !== enterpriseId) return;

    if (doc.documentType === DocumentType.TransferToolsToClient) {
      await this.notifyTransfer(doc);
      return;
    }
    if (doc.documentType === DocumentType.ReceiveToolsFromClient) {
      await this.notifyReceive(doc);
      return;
    }
    if (doc.documentType === DocumentType.ComeCashFromClients) {
      await this.notifyCash(doc);
    }
  }

  private async notifyTransfer(doc: Document): Promise<void> {
    const clientId = Number(doc.docValues?.receiverId);
    if (!clientId) return;

    const telegramId = await this.resolveClientTelegramId(clientId);
    if (!telegramId) return;

    const items = this.getTransferToolRows(doc);
    const nameMap = await this.resolveToolNamesByAnaliticIds(
      items.map((row) => Number(row.analiticId)),
    );
    const toolItems = items.map((row) => ({
      name: this.getToolRowName(row, nameMap),
      count: parseNumberOrFallback(row.count, 0),
    }));

    const payment = this.getPaymentBreakdown(doc, "transfer");
    const clientName = await this.resolveClientName(clientId);
    const lines = [
      `📦 <b>Ускуналар берилди</b>`,
      `Хujjat: <b>#${doc.id}</b>`,
      `Мижоз: <b>${escapeTelegramHtml(clientName)}</b>`,
      "",
      ...this.formatToolsSection("Берилган ускуналар", toolItems),
    ];

    if (payment.total > 0) {
      lines.push("", "<b>Қабул қилинган тўлов</b>");
      lines.push(...this.formatPaymentLines(payment));
    }

    lines.push("", "Батафсил: ботда <b>Ускуналар</b> тугмаси.");

    await this.send(telegramId, lines.join("\n"));
  }

  private async notifyReceive(doc: Document): Promise<void> {
    const clientId = Number(doc.docValues?.senderId);
    if (!clientId) return;

    const telegramId = await this.resolveClientTelegramId(clientId);
    if (!telegramId) return;

    const returnRows = this.getReceiveReturnRows(doc);
    const nameMap = await this.resolveToolNamesByAnaliticIds(
      returnRows.map((row) => Number(row.analiticId)),
    );
    const toolItems = returnRows.map((row) => ({
      name: this.getToolRowName(row, nameMap),
      count: parseNumberOrFallback(row.count, 0),
      rentSum: parseNumberOrFallback(row.rentSum, 0),
    }));

    const rentSum = this.sumReceiveRent(doc);
    const payment = this.getPaymentBreakdown(doc, "receive");
    const debtSum = parseNumberOrFallback(doc.docValues?.debtSum, 0);
    const clientName = await this.resolveClientName(clientId);

    const lines = [
      `✅ <b>Инструментлар қабул қилинди</b>`,
      `Хujjat: <b>#${doc.id}</b>`,
      `Мижоз: <b>${escapeTelegramHtml(clientName)}</b>`,
      "",
      ...this.formatToolsSection("Қабул қилинган", toolItems, true),
    ];

    const brakRows = this.getReceiveRowsByType(doc, "brak");
    const saleRows = this.getReceiveRowsByType(doc, "sale");
    if (brakRows.length) {
      const brakNames = await this.resolveToolNamesByAnaliticIds(
        brakRows.map((row) => Number(row.analiticId)),
      );
      lines.push(
        "",
        ...this.formatToolsSection(
          "Брак",
          brakRows.map((row) => ({
            name: this.getToolRowName(row, brakNames),
            count: parseNumberOrFallback(row.count, 0),
          })),
        ),
      );
    }
    if (saleRows.length) {
      const saleNames = await this.resolveToolNamesByAnaliticIds(
        saleRows.map((row) => Number(row.analiticId)),
      );
      lines.push(
        "",
        ...this.formatToolsSection(
          "Сотиш",
          saleRows.map((row) => ({
            name: this.getToolRowName(row, saleNames),
            count: parseNumberOrFallback(row.count, 0),
          })),
        ),
      );
    }

    if (rentSum > 0) {
      lines.push(
        "",
        `Хисобланган ижара: <b>${formatMoneyRu(rentSum)}</b> so'm`,
      );
    }

    if (payment.total > 0 || debtSum > 0) {
      lines.push("", "<b>Тўловлар</b>");
      const paymentLines = this.formatPaymentLines(payment);
      if (paymentLines.length) {
        lines.push(...paymentLines);
      }
      if (debtSum > 0) {
        lines.push(`Насияга (қарз): <b>${formatMoneyRu(debtSum)}</b> so'm`);
        const debtComment = String(doc.docValues?.debtComment ?? "").trim();
        if (debtComment) {
          lines.push(
            `Насия учун изох: ${escapeTelegramHtml(debtComment)}`,
          );
        }
      }
    }

    lines.push("", "Ҳисоб: <b>Ҳисоб</b> тугмасини босинг.");

    await this.send(telegramId, lines.join("\n"));
  }

  private async notifyCash(doc: Document): Promise<void> {
    const clientId = Number(
      doc.docValues?.senderId || doc.docValues?.receiverId,
    );
    if (!clientId) return;

    const telegramId = await this.resolveClientTelegramId(clientId);
    if (!telegramId) return;

    const total = Number((doc.docValues as any)?.total || 0);
    const clientName = await this.resolveClientName(clientId);
    const text = [
      `💵 <b>Тўлов қабул қилинди</b>`,
      `Хujjat: <b>#${doc.id}</b>`,
      `Мижоз: <b>${escapeTelegramHtml(clientName)}</b>`,
      total > 0 ? `Сумма: <b>${formatMoneyRu(total)}</b> so'm` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await this.send(telegramId, text);
  }

  private getTransferToolRows(doc: Document): DocTableItems[] {
    return (doc.docTableItems ?? []).filter(
      (row) => Number(row.analiticId) > 0,
    );
  }

  private getReceiveReturnRows(doc: Document): DocTableItems[] {
    return (doc.docTableItems ?? []).filter(
      (row) =>
        Number(row.analiticId) > 0 &&
        (!row.tableType || row.tableType === "return"),
    );
  }

  private getReceiveRowsByType(
    doc: Document,
    tableType: "brak" | "sale",
  ): DocTableItems[] {
    return (doc.docTableItems ?? []).filter(
      (row) => Number(row.analiticId) > 0 && row.tableType === tableType,
    );
  }

  private getToolRowName(
    row: DocTableItems,
    nameMap: Map<number, string>,
  ): string {
    const fromRow = String((row as any).analiticName || (row as any).name || "").trim();
    if (fromRow) return fromRow;
    const fromRef = nameMap.get(Number(row.analiticId));
    if (fromRef) return fromRef;
    return `№${row.analiticId}`;
  }

  private async resolveToolNamesByAnaliticIds(
    ids: number[],
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const unique = [...new Set(ids.filter((id) => id > 0))];
    await Promise.all(
      unique.map(async (id) => {
        try {
          const ref = await this.referencesService.getReferenceById(id);
          if (ref?.name) map.set(id, ref.name);
        } catch {
          /* skip */
        }
      }),
    );
    return map;
  }

  private formatToolsSection(
    title: string,
    items: ToolListItem[],
    withRent = false,
  ): string[] {
    if (!items.length) {
      return [`<b>${title}</b>`, "—"];
    }

    if (items.length >= TOOLS_TABLE_THRESHOLD) {
      const nameWidth = withRent ? 16 : 20;
      const columns = withRent
        ? [
            { header: "№", width: 3, align: "right" as const },
            { header: "Номи", width: nameWidth },
            { header: "Miq", width: 4, align: "right" as const },
            { header: "Ijara", width: 9, align: "right" as const },
          ]
        : [
            { header: "№", width: 3, align: "right" as const },
            { header: "Номи", width: nameWidth },
            { header: "Miq", width: 4, align: "right" as const },
          ];

      const table = formatTelegramPlainTable(
        columns,
        items.map((item, idx) => {
          const row = [
            String(idx + 1),
            this.truncatePlain(item.name, nameWidth),
            String(item.count),
          ];
          if (withRent) {
            row.push(
              item.rentSum && item.rentSum > 0
                ? formatMoneyRu(item.rentSum)
                : "—",
            );
          }
          return row;
        }),
      );
      return [`<b>${title}</b>`, `<pre>${escapeTelegramHtml(table)}</pre>`];
    }

    const lines = [`<b>${title}</b>`];
    for (const item of items) {
      const rentPart =
        withRent && item.rentSum && item.rentSum > 0
          ? ` · ижара <b>${formatMoneyRu(item.rentSum)}</b> so'm`
          : "";
      lines.push(
        `• <b>${escapeTelegramHtml(item.name)}</b> — ${item.count} дона${rentPart}`,
      );
    }
    return lines;
  }

  private getPaymentBreakdown(
    doc: Document,
    mode: "transfer" | "receive",
  ): PaymentBreakdown {
    const dv = doc.docValues;
    const cash =
      mode === "transfer"
        ? parseNumberOrFallback(dv?.initialPayment, 0)
        : parseNumberOrFallback(dv?.initialPayment, 0) ||
          parseNumberOrFallback(dv?.cashReceived, 0);
    const plastic =
      mode === "transfer"
        ? parseNumberOrFallback(dv?.cashFromPartner, 0)
        : parseNumberOrFallback(dv?.cashFromPartner, 0) ||
          parseNumberOrFallback(dv?.plasticReceived, 0);
    const usd = parseNumberOrFallback(dv?.usd, 0);
    const usdRate = parseNumberOrFallback(dv?.currency, 0);
    const usdInSom = usd > 0 && usdRate > 0 ? usd * usdRate : 0;

    return {
      cash,
      plastic,
      usd,
      usdRate,
      usdInSom,
      total: cash + plastic + usdInSom,
    };
  }

  private formatPaymentLines(breakdown: PaymentBreakdown): string[] {
    const lines: string[] = [];
    if (breakdown.cash > 0) {
      lines.push(`Накд: <b>${formatMoneyRu(breakdown.cash)}</b> so'm`);
    }
    if (breakdown.plastic > 0) {
      lines.push(`Пластик: <b>${formatMoneyRu(breakdown.plastic)}</b> so'm`);
    }
    if (breakdown.usd > 0) {
      const somPart =
        breakdown.usdInSom > 0
          ? ` (${formatMoneyRu(breakdown.usdInSom)} so'm)`
          : "";
      lines.push(
        `USD: <b>${formatMoneyRu(breakdown.usd)}</b> $${somPart}`,
      );
    }
    if (breakdown.total > 0) {
      lines.push(`Жами тўлов: <b>${formatMoneyRu(breakdown.total)}</b> so'm`);
    }
    return lines;
  }

  private truncatePlain(value: string, maxLen: number): string {
    if (value.length <= maxLen) return value;
    return value.slice(0, maxLen - 1) + "…";
  }

  private sumReceiveRent(doc: Document): number {
    return (doc.docTableItems ?? [])
      .filter((row) => (row.tableType || "return") === "return")
      .reduce(
        (sum, row) => sum + parseNumberOrFallback(row.rentSum, 0),
        0,
      );
  }

  private async resolveClientName(clientId: number): Promise<string> {
    try {
      const ref = await this.referencesService.getReferenceById(clientId);
      return ref?.name?.trim() || `№${clientId}`;
    } catch {
      return `№${clientId}`;
    }
  }

  private async resolveClientTelegramId(
    clientId: number,
  ): Promise<string | null> {
    try {
      return await this.referencesService.getClientTelegramIdByPartnerId(
        clientId,
      );
    } catch {
      return null;
    }
  }

  private async send(telegramId: string, text: string): Promise<void> {
    try {
      await this.telegramBotService.sendMessage(
        telegramId,
        text,
        { parse_mode: "HTML" },
        TelegramBotId.RENTAL_CLIENT,
      );
    } catch (error: any) {
      this.logger.warn(`Rental client notify failed: ${error?.message}`);
    }
  }
}
