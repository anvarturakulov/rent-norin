import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderCuttingIssue } from "./orderCuttingIssue.model";
import { OrderCuttingOutput } from "./orderCuttingOutput.model";
import { OrderCuttingService } from "./orderCutting.service";
import { OrderCuttingController } from "./orderCutting.controller";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";

@Module({
  imports: [
    SequelizeModule.forFeature([
      OrderCuttingIssue,
      OrderCuttingOutput,
      FurnitureOrder,
      Reference,
    ]),
  ],
  providers: [OrderCuttingService],
  controllers: [OrderCuttingController],
  exports: [OrderCuttingService],
})
export class OrderCuttingModule {}
