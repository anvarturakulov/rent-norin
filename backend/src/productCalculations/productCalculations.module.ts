import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ProductCalculationsService } from "./productCalculations.service";
import { ProductCalculationsController } from "./productCalculations.controller";
import { ProductCalculation } from "./productCalculation.model";
import { Reference } from "src/references/reference.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { Enterprise } from "src/enterprises/enterprise.model";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ProductCalculation,
      Reference,
      DocTableItems,
      Enterprise,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ProductCalculationsController],
  providers: [ProductCalculationsService],
  exports: [ProductCalculationsService],
})
export class ProductCalculationsModule {}
