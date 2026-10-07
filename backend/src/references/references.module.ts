import { forwardRef, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ReferencesController } from "./references.controller";
import { ReferencesService } from "./references.service";
import { Reference } from "./reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { DocValues } from "src/docValues/docValues.model";
import { User } from "src/users/users.model";
import { AuthModule } from "src/auth/auth.module";
import { UsersModule } from "src/users/users.module";
import { Enterprise } from "src/enterprises/enterprise.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { Document } from "src/documents/document.model";
import { ProductNormsModule } from "src/productNorms/product-norms.module";
import { RentalContract } from "src/rentalContracts/rentalContract.model";
import { ClientContract } from "src/clientContracts/clientContract.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { ClientToolOpenBatch } from "src/clientToolBatches/clientToolOpenBatch.model";
import { SubleaseToolOpenBatch } from "src/subleaseToolBatches/subleaseToolOpenBatch.model";

@Module({
  controllers: [ReferencesController],
  providers: [ReferencesService],
  imports: [
    SequelizeModule.forFeature([
      User,
      Reference,
      RefValues,
      DocValues,
      DocTableItems,
      Document,
      Enterprise,
      RentalContract,
      ClientContract,
      FurnitureOrder,
      ClientToolOpenBatch,
      SubleaseToolOpenBatch,
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
    forwardRef(() => ProductNormsModule),
  ],
  exports: [ReferencesService],
})
export class ReferencesModule {}
