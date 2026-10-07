import { forwardRef, Module } from "@nestjs/common";
import { PereodicService } from "./pereodic.service";
import { PereodicController } from "./pereodic.controller";
import { SequelizeModule } from "@nestjs/sequelize";
import { Pereodic } from "./pereodic.model";
import { UsersModule } from "src/users/users.module";
import { AuthModule } from "src/auth/auth.module";

@Module({
  providers: [PereodicService],
  controllers: [PereodicController],
  exports: [PereodicService],
  imports: [
    SequelizeModule.forFeature([Pereodic]),
    forwardRef(() => AuthModule),
    UsersModule,
  ],
})
export class PereodicModule {}
