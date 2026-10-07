import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Settings } from "./settings.model";
import { SettingPereodic } from "./settingPereodic.model";
import { SettingType } from "src/interfaces/settings.interface";
import { UserRoles } from "src/interfaces/user.interface";
import { Op } from "sequelize";
import { Enterprise } from "src/enterprises/enterprise.model";
import { UpdateCreateSettingPereodicDto } from "./dto/updateCreateSettingPereodic.dto";

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings)
    private settingsRepository: typeof Settings,
    @InjectModel(SettingPereodic)
    private settingPereodicRepository: typeof SettingPereodic,
  ) {}

  // Получение всех настроек
  async getAllSettings(enterpriseId?: number): Promise<Settings[]> {
    const where: any = { markToDeleted: false };

    // Если enterpriseId передан, фильтруем настройки по нему и глобальные
    if (enterpriseId !== undefined && enterpriseId !== null) {
      where[Op.or] = [{ enterpriseId: null }, { enterpriseId }];
    }
    // Если enterpriseId не указан (undefined или null), то не ограничиваем выборку
    // и возвращаем все настройки (для ADMINGLOBAL)

    return this.settingsRepository.findAll({
      where,
      include: [{ model: Enterprise, attributes: ["id", "name"] }],
      order: [["key", "ASC"]],
    });
  }

  // Получение настройки по ключу
  async getSettingByKey(
    key: string,
    enterpriseId?: number,
  ): Promise<Settings | null> {
    // Дата запрета одна на все предприятия — только глобальная запись
    if (key === "date_ban_editing") {
      return this.settingsRepository.findOne({
        where: { key, markToDeleted: false, enterpriseId: null },
        include: [{ model: Enterprise, attributes: ["id", "name"] }],
      });
    }

    const where: any = { key, markToDeleted: false };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where[Op.or] = [{ enterpriseId: null }, { enterpriseId }];
    }

    const settings = await this.settingsRepository.findAll({
      where,
      include: [{ model: Enterprise, attributes: ["id", "name"] }],
      order: [["enterpriseId", "DESC NULLS LAST"]],
    });

    if (settings.length === 0) {
      return null;
    }

    return settings[0];
  }

  // Получение значения настройки с приоритетом предприятия
  async getSetting(key: string, enterpriseId?: number): Promise<any> {
    const setting = await this.getSettingByKey(key, enterpriseId);
    if (!setting) {
      return null;
    }
    return setting.value;
  }

  // Получение нескольких настроек по ключам
  async getSettingsByKeys(
    keys: string[],
    enterpriseId?: number,
  ): Promise<Record<string, Settings>> {
    const where: any = {
      key: { [Op.in]: keys },
      markToDeleted: false,
    };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where[Op.or] = [{ enterpriseId: null }, { enterpriseId }];
    }

    const settings = await this.settingsRepository.findAll({
      where,
      include: [{ model: Enterprise, attributes: ["id", "name"] }],
      order: [["enterpriseId", "DESC NULLS LAST"]],
    });

    // Преобразуем в объект для удобного доступа
    // При наличии нескольких настроек с одним ключом берем первую (с приоритетом предприятия)
    const result: Record<string, Settings> = {};
    const seenKeys = new Set<string>();

    settings.forEach((setting) => {
      if (!seenKeys.has(setting.key)) {
        result[setting.key] = setting;
        seenKeys.add(setting.key);
      }
    });

    return result;
  }

  // Получение настройки по ID
  async getSettingById(id: number): Promise<Settings> {
    const setting = await this.settingsRepository.findByPk(id);

    if (!setting) {
      throw new NotFoundException(`Настройка с ID ${id} не найдена`);
    }

    if (setting.markToDeleted) {
      throw new NotFoundException(`Настройка с ID ${id} помечена на удаление`);
    }

    return setting;
  }

  // Создание новой настройки
  async createSetting(createSettingDto: {
    key: string;
    type: SettingType;
    value: any;
    description?: string;
    allowedRoles?: UserRoles[];
    enterpriseId?: number | null;
    isPereodic?: boolean;
  }): Promise<Settings> {
    const where: any = { key: createSettingDto.key };
    if (createSettingDto.enterpriseId !== undefined) {
      where.enterpriseId = createSettingDto.enterpriseId ?? null;
    }

    // Проверяем, не существует ли уже настройка с таким ключом
    if (createSettingDto.key === "date_ban_editing") {
      createSettingDto.enterpriseId = null;
    }

    const existingSetting = await this.settingsRepository.findOne({
      where,
    });

    if (existingSetting && !existingSetting.markToDeleted) {
      throw new BadRequestException(
        `Настройка с ключом '${createSettingDto.key}' уже существует`,
      );
    }

    // Если настройка существует, но помечена на удаление, обновляем её
    if (existingSetting && existingSetting.markToDeleted) {
      return this.updateSetting(existingSetting.id, {
        ...createSettingDto,
        markToDeleted: false,
      });
    }

    // Преобразуем значение в зависимости от типа
    let processedValue = createSettingDto.value;
    if (createSettingDto.type === SettingType.DATE) {
      processedValue = new Date(createSettingDto.value);
    }

    return this.settingsRepository.create({
      key: createSettingDto.key,
      type: createSettingDto.type,
      value: processedValue,
      description: createSettingDto.description || "",
      allowedRoles: createSettingDto.allowedRoles || [],
      markToDeleted: false,
      enterpriseId: createSettingDto.enterpriseId ?? null,
      isPereodic: createSettingDto.isPereodic ?? false,
    });
  }

  // Обновление настройки
  async updateSetting(
    id: number,
    updateSettingDto: {
      key?: string;
      type?: SettingType;
      value?: any;
      description?: string;
      allowedRoles?: UserRoles[];
      markToDeleted?: boolean;
      isPereodic?: boolean;
    },
  ): Promise<Settings> {
    const setting = await this.getSettingById(id);

    // Если обновляется ключ, проверяем уникальность
    if (updateSettingDto.key && updateSettingDto.key !== setting.key) {
      const existingSetting = await this.settingsRepository.findOne({
        where: { key: updateSettingDto.key, markToDeleted: false },
      });

      if (existingSetting && existingSetting.id !== id) {
        throw new BadRequestException(
          `Настройка с ключом '${updateSettingDto.key}' уже существует`,
        );
      }
    }

    // Преобразуем значение в зависимости от типа
    const processedUpdateDto = { ...updateSettingDto };
    if (updateSettingDto.type === SettingType.DATE && updateSettingDto.value) {
      processedUpdateDto.value = new Date(updateSettingDto.value);
    } else if (setting.type === SettingType.DATE && updateSettingDto.value) {
      processedUpdateDto.value = new Date(updateSettingDto.value);
    }

    await setting.update(processedUpdateDto);
    return setting.reload();
  }

  // Пометка настройки на удаление
  async markSettingForDeletion(id: number): Promise<Settings> {
    return this.updateSetting(id, { markToDeleted: true });
  }

  // Восстановление настройки (снятие пометки на удаление)
  async restoreSetting(id: number): Promise<Settings> {
    return this.updateSetting(id, { markToDeleted: false });
  }

  // Полное удаление настройки
  async deleteSetting(id: number): Promise<void> {
    const setting = await this.settingsRepository.findByPk(id);

    if (!setting) {
      throw new NotFoundException(`Настройка с ID ${id} не найдена`);
    }

    await setting.destroy();
  }

  // Получение настроек по типу
  async getSettingsByType(type: SettingType): Promise<Settings[]> {
    return this.settingsRepository.findAll({
      where: { type, markToDeleted: false },
      order: [["key", "ASC"]],
    });
  }

  // Получение настроек по ролям
  async getSettingsByRoles(roles: UserRoles[]): Promise<Settings[]> {
    return this.settingsRepository.findAll({
      where: {
        markToDeleted: false,
        allowedRoles: {
          [require("sequelize").Op.overlap]: roles,
        },
      },
      order: [["key", "ASC"]],
    });
  }

  // --- Периодические значения настроек ---

  async getSettingPereodicValues(
    settingId: number,
    enterpriseId?: number | null,
  ): Promise<SettingPereodic[]> {
    const where: any = { settingId };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    } else {
      where.enterpriseId = null;
    }

    return this.settingPereodicRepository.findAll({ where });
  }

  async getSettingPereodicValueForDate(
    settingId: number,
    date: number,
    enterpriseId?: number | null,
  ): Promise<number> {
    const where: any = { settingId };

    if (enterpriseId !== undefined && enterpriseId !== null) {
      where.enterpriseId = enterpriseId;
    } else {
      where.enterpriseId = null;
    }

    let items = await this.settingPereodicRepository.findAll({ where });
    items = items
      .sort(
        (a: SettingPereodic, b: SettingPereodic) =>
          Number(a.date) - Number(b.date),
      )
      .filter((item) => item.date <= date);

    if (items.length > 0) {
      return items[items.length - 1].value;
    }
    return 0;
  }

  async getPereodicValueForDateByKey(
    key: string,
    date: number,
    enterpriseId?: number | null,
  ): Promise<number> {
    const setting = await this.getSettingByKey(
      key,
      enterpriseId !== undefined && enterpriseId !== null
        ? enterpriseId
        : undefined,
    );
    if (!setting) return 0;
    return this.getSettingPereodicValueForDate(setting.id, date, enterpriseId);
  }

  async getSettingPereodicById(
    id: number,
  ): Promise<SettingPereodic | null> {
    return this.settingPereodicRepository.findByPk(id);
  }

  async createSettingPereodic(
    dto: UpdateCreateSettingPereodicDto,
  ): Promise<SettingPereodic> {
    const payload = { ...dto };
    if (payload.settingId) {
      const parent = await this.settingsRepository.findByPk(payload.settingId);
      if (parent) {
        const parentEnt =
          parent.enterpriseId != null && Number(parent.enterpriseId) > 0
            ? Number(parent.enterpriseId)
            : null;
        if (parentEnt == null) {
          payload.enterpriseId = null;
        } else if (
          payload.enterpriseId === undefined ||
          payload.enterpriseId === null
        ) {
          payload.enterpriseId = parentEnt;
        }
      }
    }
    return this.settingPereodicRepository.create(payload);
  }

  async updateSettingPereodic(
    id: number,
    dto: UpdateCreateSettingPereodicDto,
  ): Promise<SettingPereodic | null> {
    const item = await this.settingPereodicRepository.findByPk(id);
    if (!item) {
      return null;
    }
    const payload = { ...dto };
    const settingId = payload.settingId ?? item.settingId;
    if (settingId) {
      const parent = await this.settingsRepository.findByPk(settingId);
      if (parent) {
        const parentEnt =
          parent.enterpriseId != null && Number(parent.enterpriseId) > 0
            ? Number(parent.enterpriseId)
            : null;
        if (parentEnt == null) {
          payload.enterpriseId = null;
        } else if (
          payload.enterpriseId === undefined ||
          payload.enterpriseId === null
        ) {
          payload.enterpriseId = parentEnt;
        }
      }
    }
    await item.update({ ...payload });
    return item;
  }

  async deleteSettingPereodic(id: number): Promise<SettingPereodic | null> {
    const item = await this.settingPereodicRepository.findByPk(id);
    if (!item) {
      return null;
    }
    await item.destroy();
    return item;
  }

  /** Глобальная дата запрета редактирования документов (все предприятия). */
  async getDateBanEditingValue(): Promise<unknown> {
    const setting = await this.getSettingByKey("date_ban_editing");
    return setting?.value ?? null;
  }
}
