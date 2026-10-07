import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderWork } from "./orderWork.model";
import { OrderWorksService } from "./orderWorks.service";
import { OrderWorksController } from "./orderWorks.controller";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";

@Module({
  imports: [
    SequelizeModule.forFeature([
      OrderWork,
      OrderWorkLog,
      OrderProductionQueue,
      Document,
      DocValues,
      FurnitureOrder,
      Reference,
      RefValues,
    ]),
  ],
  providers: [OrderWorksService],
  controllers: [OrderWorksController],
  exports: [OrderWorksService],
})
export class OrderWorksModule {}
