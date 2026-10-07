import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderPipelineStage } from "./orderPipelineStage.model";
import { OrderPipelineService } from "./orderPipeline.service";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderStageHistory } from "src/orderStageHistory/orderStageHistory.model";
@Module({
  imports: [
    SequelizeModule.forFeature([
      OrderPipelineStage,
      FurnitureOrder,
      OrderProductionQueue,
      OrderWork,
      OrderStageHistory,
    ]),
  ],
  providers: [OrderPipelineService],
  exports: [OrderPipelineService],
})
export class OrderPipelineModule {}
