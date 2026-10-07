import { forwardRef, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthModule } from "src/auth/auth.module";
import { UsersModule } from "src/users/users.module";
import { Enterprise } from "src/enterprises/enterprise.model";
import { PricingMarkupDefinition } from "./pricingMarkupDefinition.model";
import { PricingPolicySnapshot } from "./pricingPolicySnapshot.model";
import { PricingPolicySnapshotValue } from "./pricingPolicySnapshotValue.model";
import { PricingPolicyController } from "./pricing-policy.controller";
import { PricingPolicyService } from "./pricing-policy.service";

@Module({
  imports: [
    SequelizeModule.forFeature([
      PricingMarkupDefinition,
      PricingPolicySnapshot,
      PricingPolicySnapshotValue,
      Enterprise,
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
  ],
  controllers: [PricingPolicyController],
  providers: [PricingPolicyService],
  exports: [PricingPolicyService],
})
export class PricingPolicyModule {}
