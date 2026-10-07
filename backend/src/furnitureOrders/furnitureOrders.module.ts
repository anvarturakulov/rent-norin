import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { FurnitureOrder } from "./furnitureOrder.model";
import { FurnitureOrdersService } from "./furnitureOrders.service";
import { FurnitureOrdersController } from "./furnitureOrders.controller";
import { OrderPipelineModule } from "src/orderPipeline/orderPipeline.module";
import { OrderPipelineStage } from "src/orderPipeline/orderPipelineStage.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderCommonWork } from "src/orderCommonWorks/orderCommonWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderStageHistory } from "src/orderStageHistory/orderStageHistory.model";
import { ProductNormsModule } from "src/productNorms/product-norms.module";
import { ClientContractOrderLine } from "src/clientContracts/clientContractOrderLine.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { OrderWorkLogMaterial } from "src/orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderWorkLogWorker } from "src/orderWorkLogWorkers/orderWorkLogWorker.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { Entry } from "src/entries/entry.model";
import { DocumentsModule } from "src/documents/documents.module";
import { ReferencesModule } from "src/references/references.module";
import { UsersModule } from "src/users/users.module";
import { OrderStoreWorkService } from "./order-store-work.service";
import { ReportsModule } from "src/reports/reports.module";
import { OrderMaterialsModule } from "src/orderMaterials/orderMaterials.module";
import { OrderHalfstuffsModule } from "src/orderHalfstuffs/orderHalfstuffs.module";
import { SettingsModule } from "src/settings/settings.module";

@Module({
  imports: [
    SequelizeModule.forFeature([
      FurnitureOrder,
      OrderPipelineStage,
      OrderProductionQueue,
      OrderWork,
      OrderCommonWork,
      OrderMaterial,
      OrderStageHistory,
      ClientContractOrderLine,
      OrderWorkLog,
      OrderWorkLogMaterial,
      OrderWorkLogWorker,
      Document,
      DocValues,
      DocTableItems,
      Entry,
    ]),
    OrderPipelineModule,
    ProductNormsModule,
    DocumentsModule,
    ReferencesModule,
    UsersModule,
    ReportsModule,
    OrderMaterialsModule,
    OrderHalfstuffsModule,
    SettingsModule,
  ],
  providers: [FurnitureOrdersService, OrderStoreWorkService],
  controllers: [FurnitureOrdersController],
  exports: [FurnitureOrdersService],
})
export class FurnitureOrdersModule {}
