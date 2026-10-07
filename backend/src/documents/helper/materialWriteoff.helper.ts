import { BadRequestException } from "@nestjs/common";
import { SettingsService } from "src/settings/settings.service";

export async function resolveMaterialWriteoffChargeId(
  settingsService: SettingsService,
  enterpriseId?: number | null,
): Promise<number> {
  const raw = await settingsService.getSetting(
    "materialWriteoffChargeId",
    enterpriseId ?? undefined,
  );
  const id = raw != null ? Number(raw) : 0;
  if (!id) {
    throw new BadRequestException(
      "Не задана настройка materialWriteoffChargeId (статья затрат для списания материалов по заказу)",
    );
  }
  return id;
}

export async function resolveProductionReceiptProductChargeId(
  settingsService: SettingsService,
  enterpriseId?: number | null,
): Promise<number> {
  const raw = await settingsService.getSetting(
    "productionReceiptProductChargeId",
    enterpriseId ?? undefined,
  );
  const id = raw != null ? Number(raw) : 0;
  if (!id) {
    throw new BadRequestException(
      "Не задана настройка productionReceiptProductChargeId (статья затрат для прихода готовой продукции с производства)",
    );
  }
  return id;
}

export async function resolveProductionReceiptHalfstuffChargeId(
  settingsService: SettingsService,
  enterpriseId?: number | null,
): Promise<number> {
  const raw = await settingsService.getSetting(
    "productionReceiptHalfstuffChargeId",
    enterpriseId ?? undefined,
  );
  const id = raw != null ? Number(raw) : 0;
  if (!id) {
    throw new BadRequestException(
      "Не задана настройка productionReceiptHalfstuffChargeId (статья затрат для прихода полуфабриката с производства)",
    );
  }
  return id;
}

export async function resolveHalfstuffWriteoffChargeId(
  settingsService: SettingsService,
  enterpriseId?: number | null,
): Promise<number> {
  const raw = await settingsService.getSetting(
    "halfstuffWriteoffChargeId",
    enterpriseId ?? undefined,
  );
  const id = raw != null ? Number(raw) : 0;
  if (!id) {
    throw new BadRequestException(
      "Не задана настройка halfstuffWriteoffChargeId (статья затрат для списания полуфабрикатов по заказу)",
    );
  }
  return id;
}
