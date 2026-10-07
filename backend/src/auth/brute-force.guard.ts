import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { AuthBruteForceService } from "./auth-brute-force.service";

@Injectable()
export class BruteForceGuard implements CanActivate {
  constructor(private authBruteForceService: AuthBruteForceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Получаем email из тела запроса
    const email = request.body?.email;

    if (!email) {
      // Если email нет, пропускаем проверку (валидация будет в контроллере/сервисе)
      return true;
    }

    // Проверяем блокировку
    const isBlocked = await this.authBruteForceService.checkBlocked(ip, email);

    if (isBlocked) {
      throw new HttpException(
        "Доступ временно заблокирован из-за множественных неудачных попыток. Попробуйте через 1 час.",
        HttpStatus.LOCKED,
      );
    }

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
