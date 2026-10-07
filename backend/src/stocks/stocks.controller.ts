import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { StocksService } from "./stocks.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Schet } from "src/interfaces/report.interface";

@Controller("stocks")
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  // Эндпоинт для получения остатка по конкретному товару
  @Get("by-item")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  async getStockByItem(
    @Query("schet") schet: Schet,
    @Query("warehouseId") warehouseId: number,
    @Query("productId") productId: number,
    @Query("date") date?: number,
    @Query("enterpriseId") enterpriseId?: number,
    @Request() req?: any,
  ) {
    // ВАЖНО: Используем дату документа, если передана, иначе текущую дату
    // Дата документа должна быть передана из фронтенда
    const oneDay = 24 * 60 * 60 * 1000;
    const targetDate = date ? Number(date) + oneDay : Date.now() + oneDay;

    // Приоритет: переданный enterpriseId > enterpriseId из пользователя
    let actualEnterpriseId: number | undefined;
    if (enterpriseId) {
      actualEnterpriseId = Number(enterpriseId);
    } else if (req?.user?.enterpriseId) {
      actualEnterpriseId = req.user.enterpriseId;
    }

    // Определяем firstSubcontoId и secondSubcontoId
    const schetsWithOneSubconto = [
      Schet.S40,
      Schet.S50,
      Schet.S60,
      Schet.S66,
      Schet.S67,
      Schet.S71,
      Schet.S65,
      Schet.S64,
      Schet.S68,
      Schet.S41,
    ];

    let firstSubcontoId: number | null;
    let secondSubcontoId: number | null;

    if (schetsWithOneSubconto.includes(schet)) {
      firstSubcontoId = productId;
      secondSubcontoId = null;
    } else {
      firstSubcontoId = warehouseId || null;
      secondSubcontoId = productId;
    }

    const stockData = await this.stocksService.getStockByDate(
      schet,
      firstSubcontoId,
      secondSubcontoId,
      targetDate,
      undefined,
      actualEnterpriseId,
    );

    // Возвращаем данные в формате, совместимом с StockData для расчета себестоимости
    return {
      totalQuantity: stockData.remainCount || 0,
      totalSum: stockData.remainTotal || 0,
      totalSumUsd: stockData.remainUsd || 0,
      reservedQuantity: 0,
      availableQuantity: stockData.remainCount || 0,
      availableSum: stockData.remainTotal || 0,
      availableSumUsd: stockData.remainUsd || 0,
      lastUpdate: targetDate,
    };
  }
}
