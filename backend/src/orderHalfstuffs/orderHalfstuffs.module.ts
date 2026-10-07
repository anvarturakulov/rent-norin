import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { OrderHalfstuff } from "./orderHalfstuff.model";
import { OrderHalfstuffsService } from "./orderHalfstuffs.service";
import { OrderHalfstuffsController } from "./orderHalfstuffs.controller";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";

@Module({
  imports: [
    SequelizeModule.forFeature([OrderHalfstuff, Reference, RefValues]),
  ],
  providers: [OrderHalfstuffsService],
  controllers: [OrderHalfstuffsController],
  exports: [OrderHalfstuffsService],
})
export class OrderHalfstuffsModule {}
