import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderCommonWork } from "./orderCommonWork.model";
import { OrderCommonWorksService } from "./orderCommonWorks.service";
import { OrderCommonWorksController } from "./orderCommonWorks.controller";

@Module({
  imports: [SequelizeModule.forFeature([OrderCommonWork])],
  providers: [OrderCommonWorksService],
  controllers: [OrderCommonWorksController],
  exports: [OrderCommonWorksService],
})
export class OrderCommonWorksModule {}
