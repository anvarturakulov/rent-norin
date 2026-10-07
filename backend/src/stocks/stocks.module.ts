import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StocksService } from "./stocks.service";
import { StocksController } from "./stocks.controller";
import { SequelizeModule } from "@nestjs/sequelize";
import { Stock } from "./stock.model";
import { AuthModule } from "src/auth/auth.module";
import { Enterprise } from "src/enterprises/enterprise.model";

@Module({
  providers: [StocksService],
  controllers: [StocksController],
  exports: [StocksService],
  imports: [
    SequelizeModule.forFeature([Stock, Enterprise]),
    ConfigModule,
    forwardRef(() => AuthModule),
  ],
})
export class StocksModule {}
