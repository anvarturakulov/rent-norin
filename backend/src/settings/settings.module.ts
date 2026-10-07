import { forwardRef, Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { RegistryService } from "./registry.service";
import { Settings } from "./settings.model";
import { SettingPereodic } from "./settingPereodic.model";
import { Enterprise } from "src/enterprises/enterprise.model";
import { AuthModule } from "src/auth/auth.module";
import { UsersModule } from "src/users/users.module";

@Module({
  imports: [
    SequelizeModule.forFeature([Settings, SettingPereodic, Enterprise]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, RegistryService],
  exports: [SettingsService, RegistryService],
})
export class SettingsModule {}
