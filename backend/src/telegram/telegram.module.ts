import { forwardRef, Module, Global } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ClientToolBatchesModule } from "src/clientToolBatches/clientToolBatches.module";
import { FurnitureOrdersModule } from "src/furnitureOrders/furnitureOrders.module";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { ReferencesModule } from "src/references/references.module";
import { ReportsModule } from "src/reports/reports.module";
import { StocksModule } from "src/stocks/stocks.module";
import { EntriesModule } from "src/entries/entries.module";
import { TelegramClientService } from "./telegram-client.service";
import { TelegramBotService } from "./telegram-bot.service";
import { TelegramOrderNotifierService } from "./telegram-order-notifier.service";
import { MediatorTelegramNotifierService } from "./mediator-telegram-notifier.service";
import { RentalClientSummaryService } from "./rental-client-summary.service";
import { RentalClientTelegramNotifierService } from "./rental-client-telegram-notifier.service";
import { TelegramRentalClientService } from "./telegram-rental-client.service";
import { TelegramRentalMediatorService } from "./telegram-rental-mediator.service";
import { TelegramFurnitureSalaryService } from "./telegram-furniture-salary.service";
import { TelegramFurnitureWorkerService } from "./telegram-furniture-worker.service";
import { WorkerSalaryAccountService } from "./worker-salary-account.service";
import { FurnitureSalaryTelegramNotifierService } from "./furniture-salary-telegram-notifier.service";
import { TelegramDashboardAuthService } from "./telegram-dashboard-auth.service";

@Global()
@Module({
  imports: [
    SequelizeModule.forFeature([FurnitureOrder]),
    forwardRef(() => FurnitureOrdersModule),
    forwardRef(() => ReferencesModule),
    forwardRef(() => ReportsModule),
    StocksModule,
    EntriesModule,
    ClientToolBatchesModule,
  ],
  providers: [
    TelegramBotService,
    TelegramClientService,
    TelegramOrderNotifierService,
    MediatorTelegramNotifierService,
    RentalClientSummaryService,
    RentalClientTelegramNotifierService,
    TelegramRentalClientService,
    TelegramRentalMediatorService,
    WorkerSalaryAccountService,
    FurnitureSalaryTelegramNotifierService,
    TelegramFurnitureSalaryService,
    TelegramFurnitureWorkerService,
    TelegramDashboardAuthService,
  ],
  exports: [
    TelegramBotService,
    TelegramOrderNotifierService,
    MediatorTelegramNotifierService,
    RentalClientTelegramNotifierService,
    FurnitureSalaryTelegramNotifierService,
    TelegramDashboardAuthService,
  ],
})
export class TelegramModule {}
