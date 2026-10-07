import { Module, forwardRef } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { ScheduleModule } from "@nestjs/schedule";
import { UploadController } from "./upload.controller";
import { UploadsExportController } from "./uploadsExport.controller";
import { UploadsExportService } from "./uploadsExport.service";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MulterModule.register({
      dest: "./uploads", // Базовая папка для загрузок
    }),
    ScheduleModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [UploadController, UploadsExportController],
  providers: [UploadsExportService],
})
export class UploadModule {}
