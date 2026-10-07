import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { StocksModule } from "src/stocks/stocks.module";
import { ClientToolBatchConsumption } from "./clientToolBatchConsumption.model";
import { ClientToolOpenBatch } from "./clientToolOpenBatch.model";
import { ClientToolBatchesService } from "./clientToolBatches.service";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ClientToolOpenBatch,
      ClientToolBatchConsumption,
    ]),
    StocksModule,
  ],
  providers: [ClientToolBatchesService],
  exports: [ClientToolBatchesService],
})
export class ClientToolBatchesModule {}
