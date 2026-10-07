import { Sequelize } from "sequelize-typescript";
import { cash } from "./cash/cash";
import { debitorKreditor } from "./debitorKreditor/debitorKreditor";
import { financial } from "./financial/financial";
import { foyda } from "./foyda/foyda";
import { giving } from "./giving/giving";
import { material } from "./material/material";
import { norma } from "./norma/norma";
import { section } from "./section/section";
import { sklad } from "./sklad/sklad";
import { Reference } from "src/references/reference.model";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { DocumentsService } from "src/documents/documents.service";
import { EntriesService } from "src/entries/entries.service";
import { svod } from "./svod/svod";
import { cashOperations } from "./cashOperations/cashOperations";
import { ExchangeService } from "src/exchange/exchange.service";
import { foydaByProduction } from "./foydaByProduction/foydaByProduction";
import { foydaByOrder } from "./foydaByOrder/foydaByOrder";
import { ReferencesService } from "src/references/references.service";
import { ProductCalculationsService } from "src/productCalculations/productCalculations.service";
import { tmcMaterialNorms } from "./tmcMaterialNorms/tmcMaterialNorms";
import { enterpriseIntercompanyReport } from "./enterpriseIntercompanyReport/enterpriseIntercompanyReport";
import { EnterprisesService } from "src/enterprises/enterprises.service";
import { materialByDepartment } from "./materialByDepartment/materialByDepartment";
import { productionMaterialVariance } from "./productionMaterialVariance/productionMaterialVariance";
import { materialPlanning } from "./materialPlanning/materialPlanning";
import { comeMaterialTmzByArticle } from "./comeMaterialTmzByArticle/comeMaterialTmzByArticle";
import { tmzMainWarehouseBalance } from "./tmzMainWarehouseBalance/tmzMainWarehouseBalance";
import { furnitureOrders } from "./furnitureOrders/furnitureOrders";
import { contractFulfillment } from "./contractFulfillment/contractFulfillment";
import { clientsContractsWork } from "./clientsContractsWork/clientsContractsWork";
import { rentalUnfulfilledOrders } from "./rentalUnfulfilledOrders/rentalUnfulfilledOrders";
import { toolsCurrentBalance } from "./toolsCurrentBalance/toolsCurrentBalance";
import { rentalNetProfit } from "../rentalNetProfit/rentalNetProfit";
import { subleasePartnerMargin } from "../subleasePartnerMargin/subleasePartnerMargin";
import { Entry } from "src/entries/entry.model";

export const information = async (
  data: any,
  startDate: number | null,
  endDate: number | null,
  reportType: string | null,
  deliverys: Reference[],
  sequelize: Sequelize,
  stocksService: StocksService,
  oborotsService: OborotsService,
  documentsService: DocumentsService,
  entriesService: EntriesService,
  exchangeService: ExchangeService,
  referencesService: ReferencesService,
  productCalculationsService: ProductCalculationsService,
  enterprisesService: EnterprisesService,
  enterpriseId?: number | null,
  reportYear?: number | null,
  singleEnterpriseMode?: boolean,
  firstSubcontoId?: number | null,
) => {
  const result: any[] = [];

  if (reportType == "Financial" || reportType == "All") {
    const financialResult = await financial(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    result.push({ reportType: "FINANCIAL", values: financialResult });
  }

  if (reportType == "Foyda" || reportType == "All") {
    const foydaResult = await foyda(
      data,
      startDate,
      endDate,
      sequelize,
      deliverys,
      stocksService,
      oborotsService,
      documentsService,
      enterpriseId,
    );
    result.push(foydaResult);
  }

  if (reportType == "Cash" || reportType == "All") {
    const cashResult = await cash(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
      exchangeService,
    );
    result.push(cashResult);
  }

  if (reportType == "CASHOPERATIONS" || reportType == "All") {
    const cashOperationsResult = await cashOperations(
      data,
      startDate,
      endDate,
      entriesService,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
    );
    result.push(cashOperationsResult);
  }

  if (reportType == "Giving" || reportType == "All") {
    const givingResult = await giving(
      data,
      startDate,
      endDate,
      oborotsService,
      enterpriseId,
    );
    result.push(givingResult);
  }

  if (reportType == "Section-buxgalter" || reportType == "All") {
    const sectionBuxResult = await section(
      "BUXGALTER",
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
    );
    result.push(sectionBuxResult);
  }
  if (reportType == "Section-filial" || reportType == "All") {
    const sectionFilResult = await section(
      "FILIAL",
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
    );
    result.push(sectionFilResult);
  }

  if (reportType == "Section-delivery" || reportType == "All") {
    const sectionDelResult = await section(
      "DELIVERY",
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
    );
    result.push(sectionDelResult);
  }

  if (reportType == "Sklad" || reportType == "All") {
    const skladResult = await sklad(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    result.push(skladResult);
  }

  if (reportType == "Norma" || reportType == "All") {
    const normaResult = await norma(
      data,
      startDate,
      endDate,
      oborotsService,
      enterpriseId,
    );
    result.push(normaResult);
  }

  if (reportType == "Material" || reportType == "All") {
    const materialResult = await material(
      data,
      startDate,
      endDate,
      oborotsService,
      enterpriseId,
    );
    result.push(materialResult);
  }

  if (reportType == "Section-founder" || reportType == "All") {
    const sectionFounderResult = await section(
      "FOUNDER",
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      referencesService,
      enterpriseId,
    );
    result.push(sectionFounderResult);
  }

  if (reportType == "DebitorKreditor" || reportType == "All") {
    const debitorKreditorResult = await debitorKreditor(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      exchangeService,
      enterpriseId,
      "balances",
    );
    result.push({
      reportType: "DEBITORKREDITOR",
      values: debitorKreditorResult,
    });
  }

  if (
    reportType == "Svod" ||
    reportType == "SvodBYCompany" ||
    reportType == "All"
  ) {
    try {
      const entries = await entriesService.getAllEntries(enterpriseId);
      const svodResult = await svod(
        data,
        startDate,
        endDate,
        sequelize,
        deliverys,
        stocksService,
        oborotsService,
        documentsService,
        entries,
        referencesService,
        enterpriseId,
        exchangeService,
      );
      result.push(svodResult);
    } catch (error) {
      console.error("Ошибка при вызове svod в information:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace",
      );
      result.push({
        reportType: "SVOD",
        costValues: [],
        cashValues: [],
        clients: [],
        departments: [],
        suppliers: [],
        skladValues: [],
        values: {},
      });
    }
  }

  if (reportType == "FoydaByOrder" || reportType == "All") {
    const foydaByOrderResult = await foydaByOrder(
      startDate,
      endDate,
      oborotsService,
      entriesService,
      enterpriseId,
    );
    result.push(foydaByOrderResult);
  }

  if (reportType == "FoydaByProduction" || reportType == "All") {
    const foydaByProductionResult = await foydaByProduction(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      entriesService,
      documentsService,
      sequelize,
      enterpriseId,
    );
    result.push(foydaByProductionResult);
  }

  if (reportType == "TmcMaterialNorms" || reportType == "All") {
    const tmcMaterialNormsResult = await tmcMaterialNorms(
      data,
      startDate,
      endDate,
      productCalculationsService,
      enterpriseId,
    );
    result.push(tmcMaterialNormsResult);
  }

  if (reportType == "ProductionMaterialVariance" || reportType == "All") {
    const productionMaterialVarianceResult = await productionMaterialVariance(
      data,
      startDate,
      endDate,
      productCalculationsService,
      enterpriseId,
    );
    result.push(productionMaterialVarianceResult);
  }

  if (reportType == "EnterpriseIntercompanyReport" || reportType == "All") {
    if (singleEnterpriseMode) {
      result.push({ reportType: "EnterpriseIntercompanyReport", values: [] });
    } else {
      const enterpriseIntercompanyReportResult =
        await enterpriseIntercompanyReport(
          data,
          startDate,
          endDate,
          oborotsService,
          enterprisesService,
          enterpriseId,
        );
      result.push(enterpriseIntercompanyReportResult);
    }
  }

  if (reportType == "MaterialByDepartment" || reportType == "All") {
    const materialByDepartmentResult = await materialByDepartment(
      data,
      startDate,
      endDate,
      oborotsService,
      enterpriseId,
    );
    result.push(materialByDepartmentResult);
  }

  if (reportType == "MaterialPlanning" || reportType == "All") {
    const materialPlanningResult = await materialPlanning(data, enterpriseId);
    result.push(materialPlanningResult);
  }

  if (reportType == "ComeMaterialTmzByArticle" || reportType == "All") {
    const comeMaterialTmzResult = await comeMaterialTmzByArticle(
      data,
      startDate,
      endDate,
      enterpriseId,
    );
    result.push(comeMaterialTmzResult);
  }

  if (reportType == "TmzMainWarehouseBalance" || reportType == "All") {
    const tmzBalanceResult = await tmzMainWarehouseBalance(
      data,
      endDate,
      enterpriseId,
    );
    result.push(tmzBalanceResult);
  }

  if (reportType == "ToolsCurrentBalance" || reportType == "All") {
    const toolsBalanceResult = await toolsCurrentBalance(
      data,
      endDate,
      enterpriseId,
      firstSubcontoId,
      referencesService,
    );
    result.push(toolsBalanceResult);
  }

  if (reportType == "FurnitureOrders") {
    const furnitureOrdersResult = await furnitureOrders(
      startDate,
      endDate,
      enterpriseId,
    );
    result.push(furnitureOrdersResult);
  }

  if (reportType == "ContractFulfillment") {
    const contractFulfillmentResult = await contractFulfillment(
      startDate,
      endDate,
      enterpriseId,
    );
    result.push(contractFulfillmentResult);
  }

  if (reportType == "ClientsContractsWork") {
    const clientsContractsWorkResult = await clientsContractsWork(
      data,
      startDate,
      endDate,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    result.push(clientsContractsWorkResult);
  }

  if (reportType == "RentalUnfulfilledOrders") {
    const rentalUnfulfilledOrdersResult = await rentalUnfulfilledOrders(
      data,
      endDate,
      stocksService,
      enterpriseId,
    );
    result.push(rentalUnfulfilledOrdersResult);
  }

  if (reportType == "RentalNetProfit") {
    if (startDate && endDate) {
      const rentalNetProfitResult = await rentalNetProfit(
        startDate,
        endDate,
        enterpriseId,
        Entry,
      );
      result.push(rentalNetProfitResult);
    }
  }

  if (reportType == "SubleasePartnerMargin") {
    if (startDate && endDate) {
      const subleaseResult = await subleasePartnerMargin(
        startDate,
        endDate,
        enterpriseId,
        firstSubcontoId,
      );
      result.push(subleaseResult);
    }
  }

  return result;
};
