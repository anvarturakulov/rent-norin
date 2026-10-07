import { Module, forwardRef } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { IsapiController } from "./isapi.controller";
import { IsapiService } from "./isapi.service";
import { GateEventsModule } from "../gateEvents/gateEvents.module";

@Module({
  imports: [ConfigModule, forwardRef(() => GateEventsModule)],
  controllers: [IsapiController],
  providers: [IsapiService],
  exports: [IsapiService],
})
export class IsapiModule {}
