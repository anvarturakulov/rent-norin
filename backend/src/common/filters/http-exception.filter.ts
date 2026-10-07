import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // Список подозрительных путей от ботов-сканеров
  private readonly suspiciousPatterns = [
    /\/api\/v[0-9]+\/config/,
    /\/apikeys\.json/,
    /\/api_keys\.json/,
    /\/\.env/,
    /^\/api\/route$/,
    /^\/api$/,
    /\/wp-admin/,
    /\/wp-login/,
    /\/phpmyadmin/,
    /\/admin/,
    /\/config\./,
  ];

  private isSuspiciousRequest(url: string, status: number): boolean {
    // Проверяем только 404 ошибки
    if (status !== HttpStatus.NOT_FOUND) {
      return false;
    }

    return this.suspiciousPatterns.some((pattern) => pattern.test(url));
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Внутренняя ошибка сервера";

    // Обработка HTTP исключений NestJS
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Если ответ - объект с полем message
      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;

        // Если message - массив (например, от ValidationPipe), берем первый элемент
        if (Array.isArray(message)) {
          message = message[0] || "Ошибка валидации";
        }
      } else {
        // Если ответ - строка
        message = (exceptionResponse as string) || exception.message;
      }
    }
    // Обработка обычных Error
    else if (exception instanceof Error) {
      message = exception.message || "Произошла ошибка";

      // Логируем ошибку для отладки
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    }
    // Обработка неизвестных ошибок
    else {
      this.logger.error(
        `Unknown exception: ${JSON.stringify(exception)}`,
        undefined,
        `${request.method} ${request.url}`,
      );
      message = "Произошла неизвестная ошибка";
    }

    // Формируем ответ в формате, который ожидает фронтенд
    const errorResponse = {
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Логируем ошибку только если это не подозрительный запрос от ботов
    if (!this.isSuspiciousRequest(request.url, status)) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    } else {
      // Опционально: логируем с более низким уровнем для статистики
      this.logger.debug(
        `[BOT SCAN] ${request.method} ${request.url} ${status}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
