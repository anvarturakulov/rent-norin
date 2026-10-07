import { Module } from "@nestjs/common";
import { EntriesService } from "./entries.service";
import { EntriesController } from "./entries.controller";
import { SequelizeModule } from "@nestjs/sequelize";
import { User } from "src/users/users.model";
import { Reference } from "src/references/reference.model";
import { Entry } from "./entry.model";
import { Document } from "src/documents/document.model";
import { Enterprise } from "src/enterprises/enterprise.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";

@Module({
  providers: [EntriesService],
  controllers: [EntriesController],
  imports: [
    SequelizeModule.forFeature([
      User,
      Reference,
      Document,
      Entry,
      Enterprise,
      FurnitureOrder,
    ]),
  ],
  exports: [EntriesService],
})
export class EntriesModule {}
