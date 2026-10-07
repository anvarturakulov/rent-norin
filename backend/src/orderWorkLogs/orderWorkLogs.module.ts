import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderWorkLog } from "./orderWorkLog.model";
import { OrderWorkLogMaterial } from "src/orderWorkLogMaterials/orderWorkLogMaterial.model";
import { OrderWorkLogsService } from "./orderWorkLogs.service";
import { OrderWorkLogsController } from "./orderWorkLogs.controller";
import { OrderWorkWriteoffController } from "./orderWorkWriteoff.controller";
import { OrderWorksModule } from "src/orderWorks/orderWorks.module";
import { OrderMaterialsModule } from "src/orderMaterials/orderMaterials.module";
import { OrderPipelineModule } from "src/orderPipeline/orderPipeline.module";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { DocumentsModule } from "src/documents/documents.module";
import { UsersModule } from "src/users/users.module";
import { ReferencesModule } from "src/references/references.module";
import { AuthModule } from "src/auth/auth.module";
import { SettingsModule } from "src/settings/settings.module";
import { OrderWorkLogWorker } from "src/orderWorkLogWorkers/orderWorkLogWorker.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";

@Module({
  imports: [
    SequelizeModule.forFeature([
      OrderWorkLog,
      OrderWorkLogMaterial,
      OrderWorkLogWorker,
      OrderWork,
      OrderMaterial,
      Document,
      DocValues,
      FurnitureOrder,
    ]),
    OrderWorksModule,
    OrderMaterialsModule,
    OrderPipelineModule,
    DocumentsModule,
    UsersModule,
    ReferencesModule,
    AuthModule,
    SettingsModule,
  ],
  providers: [OrderWorkLogsService],
  controllers: [OrderWorkLogsController, OrderWorkWriteoffController],
  exports: [OrderWorkLogsService],
})
export class OrderWorkLogsModule {}
