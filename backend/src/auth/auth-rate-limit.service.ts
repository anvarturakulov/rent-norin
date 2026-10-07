import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { AuthRateLimit } from "./auth-rate-limit.model";
import { Op } from "sequelize";

@Injectable()
export class AuthRateLimitService {
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly RATE_LIMIT_TTL = 60; // 60 секунд

  constructor(
    @InjectModel(AuthRateLimit)
    private rateLimitModel: typeof AuthRateLimit,
  ) {
    // Очищаем истекшие записи при старте
    this.cleanExpired();
    // Периодическая очистка каждые 5 минут
    setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
  }

  /**
   * Проверяет, не превышен ли лимит запросов для данного IP
   * @param ip IP адрес клиента
   * @returns true если лимит не превышен, false если превышен
   */
  async checkRateLimit(ip: string): Promise<boolean> {
    try {
      // Удаляем истекшие записи
      await this.cleanExpired();

      const record = await this.rateLimitModel.findOne({
        where: { ip },
      });

      if (!record) {
        return true; // Нет записей - разрешаем
      }

      // Проверяем, не истекла ли запись
      if (new Date() > record.expiresAt) {
        await record.destroy();
        return true;
      }

      // Проверяем лимит
      if (record.count >= this.MAX_REQUESTS_PER_MINUTE) {
        return false; // Лимит превышен
      }

      return true; // Лимит не превышен
    } catch (error) {
      console.warn("❌ Ошибка проверки rate limit:", error.message);
      // Graceful degradation: при ошибке разрешаем запрос
      return true;
    }
  }

  /**
   * Увеличивает счетчик запросов для данного IP
   * @param ip IP адрес клиента
   */
  async incrementAttempt(ip: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.RATE_LIMIT_TTL * 1000);

      const [record, created] = await this.rateLimitModel.findOrCreate({
        where: { ip },
        defaults: {
          ip,
          count: 1,
          expiresAt,
        },
      });

      if (!created) {
        // Если запись истекла, сбрасываем счетчик
        if (new Date() > record.expiresAt) {
          record.count = 1;
          record.expiresAt = expiresAt;
        } else {
          record.count += 1;
        }
        await record.save();
      }
    } catch (error) {
      console.warn("❌ Ошибка увеличения счетчика rate limit:", error.message);
      // Игнорируем ошибку, не блокируем запрос
    }
  }

  private async cleanExpired(): Promise<void> {
    try {
      await this.rateLimitModel.destroy({
        where: {
          expiresAt: {
            [Op.lt]: new Date(),
          },
        },
      });
    } catch (error) {
      console.warn("❌ Ошибка очистки истекших rate limits:", error.message);
    }
  }
}
