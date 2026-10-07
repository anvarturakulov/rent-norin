import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { UsersModule } from "./users/users.module";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { User } from "./users/users.model";
import { AuthModule } from "./auth/auth.module";
import { ReferencesModule } from "./references/references.module";
import { Reference } from "./references/reference.model";
import { RefValues } from "./refvalues/refValues.model";
import { DocumentsModule } from "./documents/documents.module";
import { DocTableItemsModule } from "./docTableItems/docTableItems.module";
import { RefValesModule } from "./refvalues/refValues.module";
import { DocValuesModule } from "./docValues/docValues.module";
import { EntriesModule } from "./entries/entries.module";
import { Entry } from "./entries/entry.model";
import { DocValues } from "./docValues/docValues.model";
import { Document } from "./documents/document.model";
import { DocTableItems } from "./docTableItems/docTableItems.model";
import { ReportsModule } from "./reports/reports.module";
import { StocksModule } from "./stocks/stocks.module";
import { Stock } from "./stocks/stock.model";
import { OborotsModule } from "./oborots/oborots.module";
import { Oborot } from "./oborots/oborot.model";
import { BackupModule } from "./backup/backup.module";
import { PereodicModule } from "./pereodic/pereodic.module";
import { UploadModule } from "./upload/upload.module";
import { TelegramModule } from "./telegram/telegram.module";
import { ProductCalculationsModule } from "./productCalculations/productCalculations.module";
import { ProductCalculation } from "./productCalculations/productCalculation.model";
import { ExchangeModule } from "./exchange/exchange.module";
import { GateEventsModule } from "./gateEvents/gateEvents.module";
import { GateEvent } from "./gateEvents/gateEvent.model";
import { SettingsModule } from "./settings/settings.module";
import { Settings } from "./settings/settings.model";
import { SettingPereodic } from "./settings/settingPereodic.model";
import { IsapiModule } from "./isapi/isapi.module";
import { Enterprise } from "./enterprises/enterprise.model";
import { EnterprisesModule } from "./enterprises/enterprises.module";
import { AuthRateLimit } from "./auth/auth-rate-limit.model";
import { AuthBruteForceAttempt } from "./auth/auth-brute-force.model";
import { AuthOtp } from "./auth/auth-otp.model";
import { FurnitureOrder } from "./furnitureOrders/furnitureOrder.model";
import { FurnitureOrdersModule } from "./furnitureOrders/furnitureOrders.module";
import { OrderPipelineStage } from "./orderPipeline/orderPipelineStage.model";
import { OrderPipelineModule } from "./orderPipeline/orderPipeline.module";
import { OrderProductionQueue } from "./orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "./orderWorks/orderWork.model";
import { OrderWorksModule } from "./orderWorks/orderWorks.module";
import { OrderMaterial } from "./orderMaterials/orderMaterial.model";
import { OrderMaterialsModule } from "./orderMaterials/orderMaterials.module";
import { OrderHalfstuff } from "./orderHalfstuffs/orderHalfstuff.model";
import { OrderHalfstuffsModule } from "./orderHalfstuffs/orderHalfstuffs.module";
import { OrderCuttingIssue } from "./orderCutting/orderCuttingIssue.model";
import { OrderCuttingOutput } from "./orderCutting/orderCuttingOutput.model";
import { OrderCuttingModule } from "./orderCutting/orderCutting.module";
import { OrderWorkLog } from "./orderWorkLogs/orderWorkLog.model";
import { OrderWorkLogsModule } from "./orderWorkLogs/orderWorkLogs.module";
import { OrderWorkLogMaterial } from "./orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderStageHistory } from "./orderStageHistory/orderStageHistory.model";
import { OrderWorkLogWorker } from "./orderWorkLogWorkers/orderWorkLogWorker.model";
import { PublicCatalogModule } from "./publicCatalog/public-catalog.module";
import { ProductNormsModule } from "./productNorms/product-norms.module";
import { ProductWorkNorm } from "./productNorms/productWorkNorm.model";
import { ProductMaterialNorm } from "./productNorms/productMaterialNorm.model";
import { ProductHalfstuffNorm } from "./productNorms/productHalfstuffNorm.model";
import { ProductProductionRoute } from "./productNorms/productProductionRoute.model";
import { ProductComponent } from "./productNorms/productComponent.model";
import { ProductCommonWorkNorm } from "./productNorms/productCommonWorkNorm.model";
import { OrderCommonWork } from "./orderCommonWorks/orderCommonWork.model";
import { OrderCommonWorksModule } from "./orderCommonWorks/orderCommonWorks.module";
import { ClientContract } from "./clientContracts/clientContract.model";
import { ClientContractOrderLine } from "./clientContracts/clientContractOrderLine.model";
import { ClientContractExpenseLine } from "./clientContracts/clientContractExpenseLine.model";
import { ClientContractItemLine } from "./clientContracts/clientContractItemLine.model";
import { ClientContractsModule } from "./clientContracts/clientContracts.module";
import { RentalContract } from "./rentalContracts/rentalContract.model";
import { RentalContractsModule } from "./rentalContracts/rentalContracts.module";
import { ClientToolBatchesModule } from "./clientToolBatches/clientToolBatches.module";
import { SubleaseToolBatchesModule } from "./subleaseToolBatches/subleaseToolBatches.module";
import { PricingPolicyModule } from "./pricingPolicy/pricing-policy.module";
import { TimeModule } from "./common/time.module";
import { PricingMarkupDefinition } from "./pricingPolicy/pricingMarkupDefinition.model";
import { PricingPolicySnapshot } from "./pricingPolicy/pricingPolicySnapshot.model";
import { PricingPolicySnapshotValue } from "./pricingPolicy/pricingPolicySnapshotValue.model";

@Module({
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 60 секунд
          limit: 300, // максимум 300 запросов за 60 секунд с одного IP
        },
      ],
      // CORS preflight не должен учитываться в лимите и не должен отваливаться раньше ответа с CORS-заголовками
      skipIf: (context) =>
        context.getType() === "http" &&
        context.switchToHttp().getRequest()?.method === "OPTIONS",
    }),
    SequelizeModule.forRoot({
      dialect: "postgres",
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      models: [
        Enterprise,
        User,
        Reference,
        RefValues,
        Entry,
        DocValues,
        DocTableItems,
        Document,
        Stock,
        Oborot,
        ProductCalculation,
        GateEvent,
        Settings,
        SettingPereodic,
        AuthRateLimit,
        AuthBruteForceAttempt,
        AuthOtp,
        FurnitureOrder,
        OrderPipelineStage,
        OrderProductionQueue,
        OrderWork,
        OrderMaterial,
        OrderHalfstuff,
        OrderCuttingIssue,
        OrderCuttingOutput,
        OrderWorkLog,
        OrderWorkLogMaterial,
        OrderWorkLogWorker,
        OrderStageHistory,
        ProductWorkNorm,
        ProductMaterialNorm,
        ProductHalfstuffNorm,
        ProductProductionRoute,
        ProductComponent,
        ProductCommonWorkNorm,
        OrderCommonWork,
        ClientContract,
        ClientContractOrderLine,
        ClientContractExpenseLine,
        ClientContractItemLine,
        PricingMarkupDefinition,
        PricingPolicySnapshot,
        PricingPolicySnapshotValue,
      ],
      autoLoadModels: true,
      sync: { force: false, alter: false },
      // logging: false
      logging: false,
      define: {
        underscored: false, // Отключено для совместимости с существующими данными
        timestamps: true, // Автоматическое добавление created_at и updated_at
      },
    }),
    UsersModule,
    AuthModule,
    ReferencesModule,
    RefValesModule,
    DocumentsModule,
    DocValuesModule,
    DocTableItemsModule,
    EntriesModule,
    ReportsModule,
    StocksModule,
    OborotsModule,
    BackupModule,
    PereodicModule,
    UploadModule,
    TelegramModule,
    ProductCalculationsModule,
    ExchangeModule,
    GateEventsModule,
    SettingsModule,
    IsapiModule,
    EnterprisesModule,
    FurnitureOrdersModule,
    OrderPipelineModule,
    OrderWorksModule,
    OrderMaterialsModule,
    OrderHalfstuffsModule,
    OrderCommonWorksModule,
    OrderCuttingModule,
    OrderWorkLogsModule,
    PublicCatalogModule,
    ProductNormsModule,
    ClientContractsModule,
    RentalContractsModule,
    ClientToolBatchesModule,
    SubleaseToolBatchesModule,
    PricingPolicyModule,
    TimeModule,
  ],
})
export class AppModule {}
