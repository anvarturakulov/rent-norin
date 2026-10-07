import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ExchangeService } from "./exchange.service";
import { ExchangeController } from "./exchange.controller";

@Module({
  imports: [HttpModule],
  controllers: [ExchangeController],
  providers: [ExchangeService],
  exports: [ExchangeService],
})
export class ExchangeModule {}
