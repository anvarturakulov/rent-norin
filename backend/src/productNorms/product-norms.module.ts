import { forwardRef, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthModule } from "src/auth/auth.module";
import { UsersModule } from "src/users/users.module";
import { ProductNormsService } from "./product-norms.service";
import { ProductNormsController } from "./product-norms.controller";
import { ProductWorkNorm } from "./productWorkNorm.model";
import { ProductMaterialNorm } from "./productMaterialNorm.model";
import { ProductHalfstuffNorm } from "./productHalfstuffNorm.model";
import { ProductProductionRoute } from "./productProductionRoute.model";
import { ProductComponent } from "./productComponent.model";
import { ProductCommonWorkNorm } from "./productCommonWorkNorm.model";
import { Reference } from "src/references/reference.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { OrderWork } from "src/orderWorks/orderWork.model";
import { OrderMaterial } from "src/orderMaterials/orderMaterial.model";
import { OrderHalfstuff } from "src/orderHalfstuffs/orderHalfstuff.model";
import { OrderCommonWork } from "src/orderCommonWorks/orderCommonWork.model";
import { OrderProductionQueue } from "src/orderProductionQueue/orderProductionQueue.model";
import { OrderWorkLog } from "src/orderWorkLogs/orderWorkLog.model";
import { ReportsModule } from "src/reports/reports.module";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ProductWorkNorm,
      ProductMaterialNorm,
      ProductHalfstuffNorm,
      ProductProductionRoute,
      ProductComponent,
      ProductCommonWorkNorm,
      Reference,
      FurnitureOrder,
      OrderWork,
      OrderMaterial,
      OrderHalfstuff,
      OrderCommonWork,
      OrderProductionQueue,
      OrderWorkLog,
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
    forwardRef(() => ReportsModule),
  ],
  controllers: [ProductNormsController],
  providers: [ProductNormsService],
  exports: [ProductNormsService],
})
export class ProductNormsModule {}
