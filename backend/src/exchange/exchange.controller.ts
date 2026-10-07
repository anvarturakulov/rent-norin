import { Controller, Get } from "@nestjs/common";
import { ExchangeService } from "./exchange.service";

@Controller("exchange")
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get("usd")
  async getUsd(): Promise<{ usdToUzs: number; date: string }> {
    const rate = await this.exchangeService.getUsdRate();
    return { usdToUzs: parseFloat(rate.Rate), date: rate.Date };
  }

  @Get("test-conversion")
  async testConversion(): Promise<{
    usdAmount: number;
    uzsAmount: number;
    rate: number;
  }> {
    const testUsdAmount = 100; // Тестируем конвертацию 100 USD
    const uzsAmount = await this.exchangeService.convertUsdToUzs(testUsdAmount);
    const rate = await this.exchangeService.getUsdRate();

    return {
      usdAmount: testUsdAmount,
      uzsAmount: uzsAmount,
      rate: parseFloat(rate.Rate),
    };
  }

  @Get("status")
  async getStatus(): Promise<{
    status: string;
    message: string;
    rate?: number;
    date?: string;
    error?: string;
  }> {
    try {
      const rate = await this.exchangeService.getUsdRate();
      return {
        status: "success",
        message: "API ЦБ Узбекистана доступен",
        rate: parseFloat(rate.Rate),
        date: rate.Date,
      };
    } catch (error) {
      return {
        status: "error",
        message: "API ЦБ Узбекистана недоступен",
        error: error.message,
      };
    }
  }
}
