import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { PereodicModule } from "src/pereodic/pereodic.module";
import { PublicCatalogController } from "./public-catalog.controller";
import { PublicCatalogService } from "./public-catalog.service";

@Module({
  imports: [SequelizeModule.forFeature([Reference, RefValues]), PereodicModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
