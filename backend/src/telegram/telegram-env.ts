import { TelegramBotId } from "./telegram-bot-id";

export function getTelegramEnterpriseFurniture(): number {
  const v = Number(process.env.TELEGRAM_ENTERPRISE_FURNITURE);
  return Number.isFinite(v) && v > 0 ? v : 36;
}

export function getTelegramEnterpriseRental(): number {
  const v = Number(process.env.TELEGRAM_ENTERPRISE_RENTAL);
  return Number.isFinite(v) && v > 0 ? v : 37;
}

export function getMiniAppFrontendUrl(): string {
  const url =
    process.env.TELEGRAM_MINIAPP_URL ||
    process.env.SERVER_URL ||
    "https://mebers.kord.uz/";
  return url.endsWith("/") ? url : `${url}/`;
}

export function getBotToken(botId: TelegramBotId): string | undefined {
  switch (botId) {
    case TelegramBotId.FURNITURE_CLIENT:
      return (
        process.env.BOT_TOKEN_FURNITURE_CLIENT?.trim() ||
        process.env.BOT_TOKEN?.trim() ||
        undefined
      );
    case TelegramBotId.FURNITURE_WORKER:
      return (
        process.env.BOT_TOKEN_FURNITURE_WORKER?.trim() ||
        process.env.BOT_TOKEN_MINIAPP?.trim() ||
        undefined
      );
    case TelegramBotId.FURNITURE_SALARY:
      return process.env.BOT_TOKEN_FURNITURE_SALARY?.trim() || undefined;
    case TelegramBotId.RENTAL_MEDIATOR:
      return process.env.BOT_TOKEN_RENTAL_MEDIATOR?.trim() || undefined;
    case TelegramBotId.RENTAL_CLIENT:
      return process.env.BOT_TOKEN_RENTAL_CLIENT?.trim() || undefined;
    case TelegramBotId.BACKUP:
      return process.env.BOT_TOKENBACKUP?.trim() || undefined;
    case TelegramBotId.DASHBOARD_AUTH:
      return process.env.BOT_TOKEN_DASHBOARD_AUTH?.trim() || undefined;
    default:
      return undefined;
  }
}

export function isGlobalPollingEnabled(): boolean {
  return process.env.TELEGRAM_POLLING !== "false";
}

/** Боты с входящими сообщениями (handlers + polling). */
export function isBotPollingEnabled(botId: TelegramBotId): boolean {
  if (!isGlobalPollingEnabled()) return false;
  if (botId === TelegramBotId.BACKUP) return false;
  return Boolean(getBotToken(botId));
}

export function isBotEnabled(botId: TelegramBotId): boolean {
  switch (botId) {
    case TelegramBotId.FURNITURE_CLIENT:
      return process.env.TELEGRAM_FURNITURE_CLIENT_ENABLED !== "false";
    case TelegramBotId.FURNITURE_SALARY:
      return process.env.TELEGRAM_FURNITURE_SALARY_ENABLED !== "false";
    case TelegramBotId.RENTAL_MEDIATOR:
      return process.env.TELEGRAM_RENTAL_MEDIATOR_ENABLED !== "false";
    case TelegramBotId.RENTAL_CLIENT:
      return process.env.TELEGRAM_RENTAL_CLIENT_ENABLED !== "false";
    case TelegramBotId.FURNITURE_WORKER:
      return process.env.TELEGRAM_FURNITURE_WORKER_ENABLED !== "false";
    case TelegramBotId.DASHBOARD_AUTH:
      return process.env.TELEGRAM_DASHBOARD_AUTH_ENABLED !== "false";
    default:
      return true;
  }
}
