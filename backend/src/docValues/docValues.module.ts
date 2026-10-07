import { Module } from "@nestjs/common";
import { DocValuesController } from "./docValues.controller";
import { DocValuesService } from "./docValues.service";
import { Reference } from "src/references/reference.model";
import { SequelizeModule } from "@nestjs/sequelize";
import { Document } from "src/documents/document.model";
import { DocValues } from "./docValues.model";

@Module({
  controllers: [DocValuesController],
  providers: [DocValuesService],
  imports: [SequelizeModule.forFeature([Reference, DocValues, Document])],
})
export class DocValuesModule {}
