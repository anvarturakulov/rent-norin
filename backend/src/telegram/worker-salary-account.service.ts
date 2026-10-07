import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { DocumentType } from "src/interfaces/document.interface";
import { Schet } from "src/interfaces/report.interface";
import { EntriesService } from "src/entries/entries.service";
import { ReferencesService } from "src/references/references.service";
import { StocksService } from "src/stocks/stocks.service";

export interface WorkerS67MovementRow {
  id: number;
  date: number;
  documentType: DocumentType | string;
  typeLabel: string;
  accrual: number;
  payment: number;
  comment: string;
  sectionName: string;
  docId: number;
}

@Injectable()
export class WorkerSalaryAccountService {
  constructor(
    private readonly stocksService: StocksService,
    private readonly entriesService: EntriesService,
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
  ) {}

  async getS67Balance(
    workerId: number,
    enterpriseId?: number | null,
  ): Promise<number> {
    const stockData = await this.stocksService.getStockByDate(
      Schet.S67,
      workerId,
      null,
      Date.now(),
      undefined,
      enterpriseId,
    );
    return -Number(stockData.remainTotal || 0);
  }

  async getS67Movements(
    workerId: number,
    enterpriseId: number | null | undefined,
    dateFrom: number,
    dateTo: number,
  ): Promise<WorkerS67MovementRow[]> {
    const entries = await this.entriesService.getAllEntriesBySchet({
      startDate: dateFrom,
      endDate: dateTo,
      schet: Schet.S67,
      firstSubcontoId: workerId,
      secondSubcontoId: null,
      thirdSubcontoId: null,
      enterpriseId,
    });

    const sorted = [...entries].sort((a, b) => {
      const dateDiff = Number(a.date || 0) - Number(b.date || 0);
      if (dateDiff !== 0) return dateDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });

    const nameCache = new Map<number, string>();
    const resolveName = async (id?: number | null): Promise<string> => {
      if (!id) return "";
      if (nameCache.has(id)) return nameCache.get(id)!;
      try {
        const ref = await this.referencesService.getReferenceById(id);
        const name = ref?.name || "";
        nameCache.set(id, name);
        return name;
      } catch {
        nameCache.set(id, "");
        return "";
      }
    };

    const rows: WorkerS67MovementRow[] = [];

    for (const entry of sorted) {
      const data = entry.dataValues ?? entry;
      const isDebit =
        data.debet === Schet.S67 &&
        Number(data.debetFirstSubcontoId) === Number(workerId);
      const isCredit =
        data.kredit === Schet.S67 &&
        Number(data.kreditFirstSubcontoId) === Number(workerId);

      if (!isDebit && !isCredit) continue;

      const accrual = isCredit ? Number(data.total || 0) : 0;
      const payment = isDebit ? Number(data.total || 0) : 0;
      if (!accrual && !payment) continue;

      const sectionId = isDebit
        ? data.debetSecondSubcontoId
        : data.kreditSecondSubcontoId;
      const sectionName = await resolveName(sectionId);

      rows.push({
        id: Number(data.id || 0),
        date: Number(data.date || 0),
        documentType: data.documentType,
        typeLabel: this.resolveTypeLabel(data.documentType, data.description),
        accrual,
        payment,
        comment: String(data.description || "").trim(),
        sectionName,
        docId: Number(data.docId || 0),
      });
    }

    return rows;
  }

  resolveTypeLabel(
    documentType?: DocumentType | string | null,
    description?: string | null,
  ): string {
    if (documentType === DocumentType.ZpCalculate) return "Ҳисоб";
    if (documentType === DocumentType.LeaveCash) return "Тўлов";
    if (description) {
      return description.length > 12
        ? `${description.slice(0, 11)}…`
        : description;
    }
    return String(documentType || "—");
  }
}
