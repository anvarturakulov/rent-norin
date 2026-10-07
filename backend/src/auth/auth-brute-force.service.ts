import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { AuthBruteForceAttempt } from "./auth-brute-force.model";
import { Op } from "sequelize";

@Injectable()
export class AuthBruteForceService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly BLOCK_TTL = 3600; // 1 час в секундах

  constructor(
    @InjectModel(AuthBruteForceAttempt)
    private bruteForceModel: typeof AuthBruteForceAttempt,
  ) {
    // Очищаем истекшие записи при старте
    this.cleanExpired();
    // Периодическая очистка каждые 10 минут
    setInterval(() => this.cleanExpired(), 10 * 60 * 1000);
  }

  /**
   * Проверяет, заблокирован ли доступ для данного IP и email
   * @param ip IP адрес клиента
   * @param email Email пользователя
   * @returns true если заблокирован, false если не заблокирован
   */
  async checkBlocked(ip: string, email: string): Promise<boolean> {
    try {
      // Удаляем истекшие записи
      await this.cleanExpired();

      // Проверяем блокировку по IP
      const ipRecord = await this.bruteForceModel.findOne({
        where: {
          ip,
          email: "", // Ищем записи только для IP (email пустой)
        },
      });

      if (ipRecord && new Date() <= ipRecord.expiresAt) {
        if (ipRecord.attempts >= this.MAX_FAILED_ATTEMPTS) {
          return true; // Заблокирован по IP
        }
      }

      // Проверяем блокировку по email
      const emailRecord = await this.bruteForceModel.findOne({
        where: {
          email,
          ip: "", // Ищем записи только для email (ip пустой)
        },
      });

      if (emailRecord && new Date() <= emailRecord.expiresAt) {
        if (emailRecord.attempts >= this.MAX_FAILED_ATTEMPTS) {
          return true; // Заблокирован по email
        }
      }

      return false; // Не заблокирован
    } catch (error) {
      console.warn("❌ Ошибка проверки brute force блокировки:", error.message);
      // Graceful degradation: при ошибке не блокируем
      return false;
    }
  }

  /**
   * Записывает неудачную попытку входа
   * @param ip IP адрес клиента
   * @param email Email пользователя
   */
  async recordFailedAttempt(ip: string, email: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.BLOCK_TTL * 1000);

      // Обновляем или создаем запись для IP
      const [ipRecord, ipCreated] = await this.bruteForceModel.findOrCreate({
        where: {
          ip,
          email: "", // Пустой email для IP-записи
        },
        defaults: {
          ip,
          email: "",
          attempts: 1,
          expiresAt,
        },
      });

      if (!ipCreated) {
        if (new Date() > ipRecord.expiresAt) {
          ipRecord.attempts = 1;
          ipRecord.expiresAt = expiresAt;
        } else {
          ipRecord.attempts += 1;
        }
        await ipRecord.save();
      }

      // Обновляем или создаем запись для email
      const [emailRecord, emailCreated] =
        await this.bruteForceModel.findOrCreate({
          where: {
            email,
            ip: "", // Пустой IP для email-записи
          },
          defaults: {
            ip: "",
            email,
            attempts: 1,
            expiresAt,
          },
        });

      if (!emailCreated) {
        if (new Date() > emailRecord.expiresAt) {
          emailRecord.attempts = 1;
          emailRecord.expiresAt = expiresAt;
        } else {
          emailRecord.attempts += 1;
        }
        await emailRecord.save();
      }

      // Логируем при достижении лимита
      if (
        ipRecord.attempts >= this.MAX_FAILED_ATTEMPTS ||
        emailRecord.attempts >= this.MAX_FAILED_ATTEMPTS
      ) {
        console.warn(
          `⚠️ Brute force блокировка: IP=${ip}, Email=${email}, IP attempts=${ipRecord.attempts}, Email attempts=${emailRecord.attempts}`,
        );
      }
    } catch (error) {
      console.warn("❌ Ошибка записи неудачной попытки:", error.message);
      // Игнорируем ошибку
    }
  }

  /**
   * Сбрасывает счетчики неудачных попыток при успешном входе
   * @param ip IP адрес клиента
   * @param email Email пользователя
   */
  async resetAttempts(ip: string, email: string): Promise<void> {
    try {
      await this.bruteForceModel.destroy({
        where: {
          [Op.or]: [
            { ip, email: "" },
            { email, ip: "" },
          ],
        },
      });
    } catch (error) {
      console.warn("❌ Ошибка сброса счетчиков brute force:", error.message);
      // Игнорируем ошибку
    }
  }

  private async cleanExpired(): Promise<void> {
    try {
      await this.bruteForceModel.destroy({
        where: {
          expiresAt: {
            [Op.lt]: new Date(),
          },
        },
      });
    } catch (error) {
      console.warn(
        "❌ Ошибка очистки истекших brute force записей:",
        error.message,
      );
    }
  }
}
