import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosResponse } from "axios";

interface CbuRate {
  id: number;
  Code: string; // '840'
  Ccy: string; // 'USD'
  CcyNm_RU: string; // 'Доллар США'
  CcyNm_UZ: string; // 'AQSH dollari'
  CcyNm_UZC: string; // 'АҚШ доллари'
  CcyNm_EN: string; // 'US Dollar'
  Nominal: string; // '1'
  Rate: string; // Курс в UZS за 1 USD (строка)
  Diff: string; // Изменение курса
  Date: string; // Дата курса
}

@Injectable()
export class ExchangeService {
  private readonly cbuApiUrl = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/"; // JSON API для курсов валют

  constructor(private readonly httpService: HttpService) {}

  async getUsdRate(): Promise<CbuRate> {
    try {
      const response: AxiosResponse<CbuRate[]> = await firstValueFrom(
        this.httpService.get(this.cbuApiUrl),
      );

      const usdRate = response.data.find(
        (currency: CbuRate) => currency.Ccy === "USD",
      );
      if (!usdRate) {
        throw new HttpException(
          "USD rate not found in CBU response",
          HttpStatus.NOT_FOUND,
        );
      }

      return usdRate;
    } catch (error) {
      throw new HttpException(
        `Не удалось получить курс USD от ЦБ Узбекистана: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async convertUsdToUzs(usdAmount: number): Promise<number> {
    try {
      const rate = await this.getUsdRate();
      const convertedAmount = usdAmount * parseFloat(rate.Rate);
      return convertedAmount;
    } catch (error) {
      throw new HttpException(
        `Не удалось конвертировать ${usdAmount} USD в UZS: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
