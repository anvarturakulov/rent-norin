import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthModule } from "src/auth/auth.module";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { RentalContract } from "./rentalContract.model";
import { RentalContractsService } from "./rentalContracts.service";
import { RentalContractsController } from "./rentalContracts.controller";

@Module({
  imports: [
    SequelizeModule.forFeature([RentalContract, Reference, RefValues]),
    AuthModule,
  ],
  controllers: [RentalContractsController],
  providers: [RentalContractsService],
  exports: [RentalContractsService],
})
export class RentalContractsModule {}
