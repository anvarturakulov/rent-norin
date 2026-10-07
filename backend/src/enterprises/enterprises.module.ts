import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { EnterprisesController } from "./enterprises.controller";
import { EnterprisesService } from "./enterprises.service";
import { Enterprise } from "./enterprise.model";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [SequelizeModule.forFeature([Enterprise]), AuthModule, UsersModule],
  controllers: [EnterprisesController],
  providers: [EnterprisesService],
  exports: [EnterprisesService],
})
export class EnterprisesModule {}
