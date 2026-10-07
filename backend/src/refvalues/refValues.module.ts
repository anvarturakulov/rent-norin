import { Module } from "@nestjs/common";
import { RefValuesService } from "./refValues.service";
import { SequelizeModule } from "@nestjs/sequelize";
import { Reference } from "src/references/reference.model";
import { RefValues } from "./refValues.model";
import { RefValesController } from "./refValues.controller";
import { Enterprise } from "src/enterprises/enterprise.model";

@Module({
  controllers: [RefValesController],
  providers: [RefValuesService],
  imports: [SequelizeModule.forFeature([Reference, RefValues, Enterprise])],
})
export class RefValesModule {}
