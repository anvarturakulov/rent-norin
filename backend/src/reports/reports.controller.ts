import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { QuerySimple, Schet } from "src/interfaces/report.interface";
import { Request } from "express";
import { requestTransform } from "./querys/requestTransform";
import { REPORT_NOT_PREPARE } from "./report.constants";
import { GetEntriesQueryDto } from "./dto/entry-query.dto";
import { ApartmentsPaymentDetailsQueryDto } from "./dto/apartments-payment-details-query.dto";
import { ClientTotalPaidDetailsQueryDto } from "./dto/client-total-paid-details-query.dto";
import { IncomeDetailsQueryDto } from "./dto/income-details-query.dto";
import { ToolsAtClientDetailsQueryDto } from "./dto/tools-at-client-details-query.dto";
import { FoydaByOrderEntriesQueryDto } from "./dto/foyda-by-order-entries-query.dto";
import { RentalExpectedIncomeQueryDto } from "./dto/rental-expected-income-query.dto";
import { SubleaseExpectedIncomeQueryDto } from "./dto/sublease-expected-income-query.dto";
import { RentalNetProfitQueryDto } from "./dto/rental-net-profit-query.dto";
import { RentalNetProfitEntriesQueryDto } from "./dto/rental-net-profit-entries-query.dto";
import { isGlobalRole } from "src/utils/roleHelpers";
import { CurrentUser } from "src/common/decorators/current-enterprise.decorator";

@Controller("reports")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private determineEnterpriseId(
    query: GetEntriesQueryDto,
    user: any,
  ): number | null {
    const isGlobal = isGlobalRole(user?.role);
    const canSelectEnterprise = isGlobal || user?.superKassir === true;

    if (canSelectEnterprise) {
      // Глобальные роли и superKassir: без enterpriseId в query — отчёт по всем предприятиям
      return query.enterpriseId !== undefined
        ? (query.enterpriseId ?? null)
        : null;
    }

    return user?.enterpriseId || null;
  }

  // @ApiOperation({summary: 'Получение всех документов'})
  // @ApiResponse({status: 200, type: [Document]})
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/query")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getQuery(@Query() query: GetEntriesQueryDto, @CurrentUser() user: any) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getQueryValue(reqQuery);
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/priceAndBalance")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getPriceAndBalance(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getPriceAndBalance(reqQuery);
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/information")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getInformation(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    // console.time('Controller');
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getInformation(reqQuery);
    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    // console.timeEnd('Controller');
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/debitorKreditorOborot")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDebitorKreditorOborot(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    return await this.reportsService.getDebitorKreditorOborot(reqQuery);
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/matOborot")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getMatOtchet(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getMatOtchet(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/osOborot")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getOsOborot(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getOsOborot(reqQuery);
    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/oborotka")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getOborotka(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getOborotka(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/personal")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getPersonal(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getPersonal(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/mediatorPersonal")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getMediatorPersonal(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getMediatorPersonal(reqQuery);
    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/delivererPersonal")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDelivererPersonal(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getDelivererPersonal(reqQuery);
    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/analitic")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAnalitic(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getAnalitic(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/clients")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getClients(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getClients(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/aktSverka")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAktSverka(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getAktSverka(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/supplierGoods")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getSupplierGoods(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getSupplierGoods(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }
    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/rentalExpectedIncome")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRentalExpectedIncome(
    @Query() query: RentalExpectedIncomeQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId = this.determineEnterpriseId(
      { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
      user,
    );
    return this.reportsService.getRentalExpectedIncome(
      query.asOf,
      enterpriseId as number,
      query.clientId,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/subleaseExpectedIncome")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getSubleaseExpectedIncome(
    @Query() query: SubleaseExpectedIncomeQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId = this.determineEnterpriseId(
      { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
      user,
    );
    return this.reportsService.getSubleaseExpectedIncome(
      query.asOf,
      enterpriseId as number,
      query.clientId,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/rentalNetProfit")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRentalNetProfit(
    @Query() query: RentalNetProfitQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId = this.determineEnterpriseId(
      { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
      user,
    );
    return this.reportsService.getRentalNetProfit(
      query.startDate,
      query.endDate,
      enterpriseId as number | null,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/rentalNetProfit/entries")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getRentalNetProfitEntries(
    @Query() query: RentalNetProfitEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId = this.determineEnterpriseId(
      { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
      user,
    );
    return this.reportsService.getRentalNetProfitEntries(
      query.type,
      query.startDate,
      query.endDate,
      query.tmzIds,
      enterpriseId as number | null,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/apartments-payment-details")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getApartmentsPaymentDetails(
    @Query() query: ApartmentsPaymentDetailsQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId =
      query.enterpriseId !== undefined
        ? query.enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
            user,
          );
    const details = await this.reportsService.getApartmentsPaymentDetails(
      query.clientId,
      query.monthKey,
      enterpriseId,
    );
    return details;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/client-total-paid-details")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getClientTotalPaidDetails(
    @Query() query: ClientTotalPaidDetailsQueryDto,
    @CurrentUser() user: any,
  ) {
    const enterpriseId =
      query.enterpriseId !== undefined
        ? query.enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
            user,
          );
    const details = await this.reportsService.getClientTotalPaidDetails(
      query.clientId,
      query.startDate,
      query.endDate,
      enterpriseId,
    );
    return details;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/expense-entries")
  async getExpenseEntries(
    @Query("debet") debet: Schet,
    @Query("kredit") kredit: Schet,
    @Query("startDate") startDate: number,
    @Query("endDate") endDate: number,
    @Query("workshopId") workshopId: number,
    @CurrentUser() user: any,
    @Query("enterpriseId") enterpriseId?: number,
  ) {
    const finalEnterpriseId =
      enterpriseId !== undefined
        ? enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId } as GetEntriesQueryDto,
            user,
          );

    const entries = await this.reportsService.getExpenseEntries(
      debet,
      kredit,
      startDate,
      endDate,
      workshopId,
      finalEnterpriseId,
    );

    return entries;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/intercompany-entries")
  async getIntercompanyEntries(
    @Query("debet") debet: Schet,
    @Query("kredit") kredit: Schet,
    @Query("startDate") startDate: number,
    @Query("endDate") endDate: number,
    @CurrentUser() user: any,
    @Query("subcontoId") subcontoId?: number,
    @Query("subcontoInDebet") subcontoInDebet?: string,
    @Query("enterpriseId") enterpriseId?: number,
  ) {
    const finalEnterpriseId =
      enterpriseId !== undefined
        ? enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId } as GetEntriesQueryDto,
            user,
          );

    const entries = await this.reportsService.getEntriesByDebetKredit(
      debet,
      kredit,
      startDate,
      endDate,
      subcontoId || null,
      subcontoInDebet === "true",
      finalEnterpriseId,
    );

    return entries;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/intercompany-entries/batch")
  async getIntercompanyEntriesBatch(
    @Query("debet") debet: Schet,
    @Query("kredit") kredit: Schet,
    @Query("startDate") startDate: number,
    @Query("endDate") endDate: number,
    @CurrentUser() user: any,
    @Query("subcontoIds") subcontoIdsRaw?: string,
    @Query("subcontoInDebet") subconтоInDebet?: string,
    @Query("enterpriseId") enterpriseId?: number,
  ) {
    const finalEnterpriseId =
      enterpriseId !== undefined
        ? enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId } as GetEntriesQueryDto,
            user,
          );

    const subconтоIds = (subcontoIdsRaw || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));

    const useSubcontoInDebet = subconтоInDebet === "true";

    const entries = await this.reportsService.getEntriesByDebetKreditBatch(
      debet,
      kredit,
      startDate,
      endDate,
      subconтоIds.length > 0 ? subconтоIds : null,
      useSubcontoInDebet,
      finalEnterpriseId,
    );

    return entries;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/foyda-by-production/income-details")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getIncomeDetails(
    @Query() query: IncomeDetailsQueryDto,
    @CurrentUser() user: any,
  ) {
    const finalEnterpriseId =
      query.enterpriseId !== undefined
        ? query.enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
            user,
          );

    const details = await this.reportsService.getIncomeDetails(
      query.workshopId,
      query.startDate,
      query.endDate,
      finalEnterpriseId,
    );

    return details;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/tools-current-balance/at-client-details")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getToolsAtClientDetails(
    @Query() query: ToolsAtClientDetailsQueryDto,
    @CurrentUser() user: any,
  ) {
    const finalEnterpriseId =
      query.enterpriseId !== undefined
        ? query.enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
            user,
          );

    return this.reportsService.getToolsAtClientDetails(
      query.toolId,
      query.endDate,
      finalEnterpriseId,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/foyda-by-order/entries")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getFoydaByOrderEntries(
    @Query() query: FoydaByOrderEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const finalEnterpriseId =
      query.enterpriseId !== undefined
        ? query.enterpriseId
        : this.determineEnterpriseId(
            { enterpriseId: query.enterpriseId } as GetEntriesQueryDto,
            user,
          );

    const orderId =
      query.orderId !== undefined && query.orderId !== null
        ? Number(query.orderId)
        : query.type === "expense"
          ? null
          : undefined;

    return this.reportsService.getFoydaByOrderEntries(
      query.type,
      query.startDate,
      query.endDate,
      orderId,
      query.saleDocId,
      query.debet,
      query.kredit,
      finalEnterpriseId,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/account-operations")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAccountOperations(
    @Query() query: GetEntriesQueryDto,
    @CurrentUser() user: any,
  ) {
    const transformedQuery = requestTransform(query);
    const enterpriseId = this.determineEnterpriseId(query, user);
    const reqQuery: QuerySimple = { ...transformedQuery, enterpriseId };
    const report = await this.reportsService.getAccountOperations(reqQuery);

    if (!report) {
      throw new NotFoundException(REPORT_NOT_PREPARE);
    }

    return report;
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/materialAveragePrice")
  async getMaterialAveragePrice(
    @Query("materialId") materialId: number,
    @CurrentUser() user: any,
  ) {
    const enterpriseId = user?.enterpriseId || null;
    return this.reportsService.getMaterialAveragePrice(
      Number(materialId),
      enterpriseId,
    );
  }

  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Post("/materialAveragePrices")
  async getMaterialAveragePrices(
    @Body() body: { materialIds: number[] },
    @CurrentUser() user: any,
  ) {
    const enterpriseId = user?.enterpriseId || null;
    return this.reportsService.getMaterialAveragePrices(
      body.materialIds,
      enterpriseId,
    );
  }
}
