import { Controller, Post, Logger, UseGuards } from "@nestjs/common";
import { BackupService } from "./backup.service";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";

@Controller("backup")
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backupService: BackupService) {}
}
