import { Injectable } from "@nestjs/common";
import { ClientToolBatchesService } from "src/clientToolBatches/clientToolBatches.service";
import { Reference } from "src/references/reference.model";
import { ReferencesService } from "src/references/references.service";
import { ReportsService } from "src/reports/reports.service";
import { getTelegramEnterpriseRental } from "./telegram-env";

export interface RentalFinancialSummary {
  s40Debt: number;
  accruedRentUnposted: number;
  totalEstimate: number;
  asOf: number;
}

export interface RentalActiveToolRow {
  toolId: number;
  toolName: string;
  openQty: number;
  settlementDate: number;
  hourlyTariff: number;
  accruedRentLine: number;
  transferDocId: number;
}

@Injectable()
export class RentalClientSummaryService {
  constructor(
    private readonly referencesService: ReferencesService,
    private readonly reportsService: ReportsService,
    private readonly clientToolBatchesService: ClientToolBatchesService,
  ) {}

  async getRentalClientByTelegramId(
    telegramId: string,
  ): Promise<Reference> {
    const enterpriseId = getTelegramEnterpriseRental();
    return this.referencesService.findClientByTelegramIdAndEnterprise(
      telegramId,
      enterpriseId,
    );
  }

  async getFinancialSummary(
    clientId: number,
    asOf: number = Date.now(),
  ): Promise<RentalFinancialSummary> {
    const enterpriseId = getTelegramEnterpriseRental();
    const debtInfo = await this.reportsService.getClientDebt(
      clientId,
      enterpriseId,
    );
    const accruedRentUnposted = await this.calcAccruedRent(
      clientId,
      enterpriseId,
      asOf,
    );
    const s40Debt = Number(debtInfo.debt) || 0;

    return {
      s40Debt,
      accruedRentUnposted,
      totalEstimate: s40Debt + accruedRentUnposted,
      asOf,
    };
  }

  async getActiveTools(
    clientId: number,
    asOf: number = Date.now(),
  ): Promise<RentalActiveToolRow[]> {
    const enterpriseId = getTelegramEnterpriseRental();

    const batches =
      await this.clientToolBatchesService.findOpenBatchesForClient(
        clientId,
        enterpriseId,
      );
    if (!batches.length) return [];

    const previewRows = await this.clientToolBatchesService.buildPreviewRows(
      batches,
      asOf,
      null,
      enterpriseId,
    );

    const rows: RentalActiveToolRow[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const preview = previewRows[i];
      const tool = await this.referencesService
        .getReferenceById(batch.toolId)
        .catch(() => null);
      rows.push({
        toolId: batch.toolId,
        toolName: tool?.name || `ID ${batch.toolId}`,
        openQty: Number(batch.openQty),
        settlementDate: Number(batch.settlementDate),
        hourlyTariff: Number(batch.hourlyTariff),
        accruedRentLine: Number(preview?.rentSum ?? 0),
        transferDocId: Number(batch.transferDocId),
      });
    }
    return rows;
  }

  private async calcAccruedRent(
    clientId: number,
    enterpriseId: number,
    asOf: number,
  ): Promise<number> {
    const batches =
      await this.clientToolBatchesService.findOpenBatchesForClient(
        clientId,
        enterpriseId,
      );
    if (!batches.length) return 0;

    const rows = await this.clientToolBatchesService.buildPreviewRows(
      batches,
      asOf,
      null,
      enterpriseId,
    );
    return rows.reduce((sum, row) => sum + Number(row.rentSum || 0), 0);
  }
}
