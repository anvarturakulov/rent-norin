import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { AuthRateLimitService } from "./auth-rate-limit.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private authRateLimitService: AuthRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Проверяем rate limit
    const isAllowed = await this.authRateLimitService.checkRateLimit(ip);

    if (!isAllowed) {
      throw new HttpException(
        "Слишком много запросов. Попробуйте позже.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Увеличиваем счетчик запросов
    await this.authRateLimitService.incrementAttempt(ip);

    return true;
  }

  /**
   * Получает IP адрес клиента из заголовков запроса
   * Учитывает заголовки от Nginx: X-Forwarded-For, X-Real-IP
   */
  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers["x-forwarded-for"] as string;
    const xRealIp = request.headers["x-real-ip"] as string;
    const remoteAddress = request.connection?.remoteAddress;

    // X-Forwarded-For может содержать несколько IP через запятую (первый - оригинальный клиент)
    if (xForwardedFor) {
      return xForwardedFor.split(",")[0].trim();
    }

    if (xRealIp) {
      return xRealIp;
    }

    if (remoteAddress) {
      // Убираем IPv6 префикс если есть
      return remoteAddress.replace("::ffff:", "");
    }

    return "unknown";
  }
}
