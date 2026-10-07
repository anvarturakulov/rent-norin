import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { Document } from "src/documents/document.model";
import { DocValues } from "src/docValues/docValues.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocumentsModule } from "src/documents/documents.module";
import { UsersModule } from "src/users/users.module";
import { ReferencesModule } from "src/references/references.module";
import { ClientContract } from "./clientContract.model";
import { ClientContractOrderLine } from "./clientContractOrderLine.model";
import { ClientContractExpenseLine } from "./clientContractExpenseLine.model";
import { ClientContractItemLine } from "./clientContractItemLine.model";
import { ClientContractsService } from "./clientContracts.service";
import { ClientContractsController } from "./clientContracts.controller";

@Module({
  imports: [
    SequelizeModule.forFeature([
      ClientContract,
      ClientContractOrderLine,
      ClientContractExpenseLine,
      ClientContractItemLine,
      FurnitureOrder,
      Reference,
      RefValues,
      Document,
      DocValues,
      DocTableItems,
    ]),
    DocumentsModule,
    UsersModule,
    ReferencesModule,
  ],
  controllers: [ClientContractsController],
  providers: [ClientContractsService],
  exports: [ClientContractsService],
})
export class ClientContractsModule {}
