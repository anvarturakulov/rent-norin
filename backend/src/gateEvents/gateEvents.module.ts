import { Module, forwardRef } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { GateEventsController } from "./gateEvents.controller";
import { GateEventsService } from "./gateEvents.service";
import { GateGateway } from "./gate-gateway";
import { GateExportService } from "./gateExport.service";
import { GateEvent } from "./gateEvent.model";
import { Reference } from "../references/reference.model";
import { RefValues } from "../refvalues/refValues.model";
import { Document } from "../documents/document.model";
import { DocValues } from "../docValues/docValues.model";
import { Enterprise } from "../enterprises/enterprise.model";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    SequelizeModule.forFeature([
      GateEvent,
      Reference,
      RefValues,
      Document,
      DocValues,
      Enterprise,
    ]),
    ConfigModule,
    ScheduleModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [GateEventsController],
  providers: [GateEventsService, GateGateway, GateExportService],
  exports: [GateEventsService, GateGateway],
})
export class GateEventsModule {}
