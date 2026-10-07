import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderMaterial } from "./orderMaterial.model";
import { OrderMaterialsService } from "./orderMaterials.service";
import { OrderMaterialsController } from "./orderMaterials.controller";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";

@Module({
  imports: [SequelizeModule.forFeature([OrderMaterial, Reference, RefValues])],
  providers: [OrderMaterialsService],
  controllers: [OrderMaterialsController],
  exports: [OrderMaterialsService],
})
export class OrderMaterialsModule {}
