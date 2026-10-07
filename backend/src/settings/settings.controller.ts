import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { SettingsService } from "./settings.service";
import { Settings } from "./settings.model";
import { SettingPereodic } from "./settingPereodic.model";
import { SettingType } from "src/interfaces/settings.interface";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RolesGuard } from "src/auth/roles.guard";
import { Roles } from "src/auth/roles-auth.decorator";
import { UserRoles } from "src/interfaces/user.interface";
import { CurrentUser } from "src/common/decorators/current-enterprise.decorator";
import { canEditGlobalSettings } from "src/utils/roleHelpers";
import { RegistryService } from "./registry.service";
import { UpdateCreateSettingPereodicDto } from "./dto/updateCreateSettingPereodic.dto";

@ApiTags("Настройки")
@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly registryService: RegistryService,
    private readonly configService: ConfigService,
  ) {}

  @Get("single-enterprise-mode")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Режим одного предприятия (из .env)" })
  @ApiResponse({
    status: 200,
    description:
      "{ singleEnterpriseMode: boolean, avtoProvodkaInManyEnterpriseMode: boolean }",
  })
  getSingleEnterpriseMode(): {
    singleEnterpriseMode: boolean;
    avtoProvodkaInManyEnterpriseMode: boolean;
  } {
    return {
      singleEnterpriseMode:
        this.configService.get("SINGLE_ENTERPRISE_MODE") === "true",
      avtoProvodkaInManyEnterpriseMode:
        this.configService.get("AVTO_PROVODKA_IN_MANY_ENTERPRISE_MODE") ===
        "true",
    };
  }

  @Get()
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить все настройки" })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Список всех настроек",
    type: [Settings],
  })
  async getAllSettings(
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<Settings[]> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getAllSettings(parsedEnterpriseId);
  }

  @Get("key/:key")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить настройку по ключу" })
  @ApiParam({ name: "key", description: "Ключ настройки" })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Настройка найдена",
    type: Settings,
  })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async getSettingByKey(
    @Param("key") key: string,
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<Settings | null> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getSettingByKey(key, parsedEnterpriseId);
  }

  @Get("key/:key/pereodic/forDate")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Получить периодическое значение настройки по ключу на дату",
  })
  @ApiParam({ name: "key", description: "Ключ настройки" })
  @ApiQuery({ name: "date", required: true, type: Number })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Значение на дату (число)" })
  async getPereodicValueForDateByKey(
    @Param("key") key: string,
    @Query("date") date: string,
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<number> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getPereodicValueForDateByKey(
      key,
      Number(date),
      parsedEnterpriseId,
    );
  }

  @Get("id/:id")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить настройку по ID" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiResponse({
    status: 200,
    description: "Настройка найдена",
    type: Settings,
  })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async getSettingById(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Settings> {
    return this.settingsService.getSettingById(id);
  }

  @Get("type/:type")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить настройки по типу" })
  @ApiParam({ name: "type", description: "Тип настройки", enum: SettingType })
  @ApiResponse({
    status: 200,
    description: "Список настроек по типу",
    type: [Settings],
  })
  async getSettingsByType(
    @Param("type") type: SettingType,
  ): Promise<Settings[]> {
    return this.settingsService.getSettingsByType(type);
  }

  @Get("roles")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить настройки по ролям" })
  @ApiQuery({ name: "roles", description: "Массив ролей", type: [String] })
  @ApiResponse({
    status: 200,
    description: "Список настроек по ролям",
    type: [Settings],
  })
  async getSettingsByRoles(@Query("roles") roles: string): Promise<Settings[]> {
    const rolesArray = roles
      .split(",")
      .map((role) => role.trim()) as UserRoles[];
    return this.settingsService.getSettingsByRoles(rolesArray);
  }

  @Post("get-multiple")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Получить несколько настроек по ключам" })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiBody({
    description: "Массив ключей настроек",
    schema: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Массив ключей настроек для получения",
        },
      },
      required: ["keys"],
    },
  })
  @ApiResponse({ status: 200, description: "Объект с настройками по ключам" })
  async getSettingsByKeys(
    @Body("keys") keys: string[],
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<Record<string, Settings>> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getSettingsByKeys(keys, parsedEnterpriseId);
  }

  @Post()
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Создать новую настройку" })
  @ApiBody({
    description: "Данные для создания настройки",
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Ключ настройки" },
        type: {
          type: "string",
          enum: Object.values(SettingType),
          description: "Тип настройки",
        },
        value: { description: "Значение настройки" },
        description: { type: "string", description: "Описание настройки" },
        allowedRoles: {
          type: "array",
          items: { type: "string" },
          description: "Разрешенные роли",
        },
        enterpriseId: {
          type: "number",
          description: "ID предприятия (null для глобальных)",
        },
        isPereodic: {
          type: "boolean",
          description: "Периодическая настройка",
        },
      },
      required: ["key", "type", "value"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Настройка создана",
    type: Settings,
  })
  @ApiResponse({ status: 400, description: "Ошибка валидации" })
  async createSetting(
    @Body()
    createSettingDto: {
      key: string;
      type: SettingType;
      value: any;
      description?: string;
      allowedRoles?: UserRoles[];
      enterpriseId?: number | null;
      isPereodic?: boolean;
    },
  ): Promise<Settings> {
    return this.settingsService.createSetting(createSettingDto);
  }

  @Put(":id")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Обновить настройку" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiBody({
    description: "Данные для обновления настройки",
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Ключ настройки" },
        type: {
          type: "string",
          enum: Object.values(SettingType),
          description: "Тип настройки",
        },
        value: { description: "Значение настройки" },
        description: { type: "string", description: "Описание настройки" },
        allowedRoles: {
          type: "array",
          items: { type: "string" },
          description: "Разрешенные роли",
        },
        isPereodic: {
          type: "boolean",
          description: "Периодическая настройка",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Настройка обновлена",
    type: Settings,
  })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  @ApiResponse({ status: 400, description: "Ошибка валидации" })
  async updateSetting(
    @Param("id", ParseIntPipe) id: number,
    @Body()
    updateSettingDto: {
      key?: string;
      type?: SettingType;
      value?: any;
      description?: string;
      allowedRoles?: UserRoles[];
      isPereodic?: boolean;
    },
  ): Promise<Settings> {
    return this.settingsService.updateSetting(id, updateSettingDto);
  }

  @Put(":id/mark-deleted")
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Пометить настройку на удаление" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiResponse({
    status: 200,
    description: "Настройка помечена на удаление",
    type: Settings,
  })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async markSettingForDeletion(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Settings> {
    return this.settingsService.markSettingForDeletion(id);
  }

  @Put(":id/restore")
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Восстановить настройку (снять пометку на удаление)",
  })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiResponse({
    status: 200,
    description: "Настройка восстановлена",
    type: Settings,
  })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async restoreSetting(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Settings> {
    return this.settingsService.restoreSetting(id);
  }

  @Delete(":id")
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Полностью удалить настройку" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiResponse({ status: 204, description: "Настройка удалена" })
  @ApiResponse({ status: 404, description: "Настройка не найдена" })
  async deleteSetting(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.settingsService.deleteSetting(id);
  }

  @Get("global/menuVisibility")
  @Roles("ALL")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Получить глобальные настройки видимости меню" })
  @ApiResponse({
    status: 200,
    description: "Глобальные настройки видимости меню",
  })
  async getGlobalMenuVisibility(): Promise<any> {
    const setting = await this.settingsService.getSettingByKey(
      "global.menuVisibility",
    );
    return setting?.value || null;
  }

  @Post("global/menuVisibility")
  @Roles("ALL")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Сохранить глобальные настройки видимости меню" })
  @ApiBody({
    description: "Глобальные настройки видимости меню",
    schema: {
      type: "object",
    },
  })
  @ApiResponse({ status: 200, description: "Глобальные настройки сохранены" })
  @ApiResponse({ status: 403, description: "Нет прав на редактирование" })
  async saveGlobalMenuVisibility(
    @Body() menuVisibility: any,
    @CurrentUser() user: any,
  ): Promise<Settings> {
    // Проверяем, что пользователь существует
    if (!user) {
      throw new HttpException(
        "Пользователь не авторизован",
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Если роль не установлена в user, пытаемся получить её из базы данных
    if (!user.role && user.email) {
      // Роль должна быть установлена RolesGuard, но на всякий случай проверяем
      throw new HttpException(
        "Роль пользователя не найдена",
        HttpStatus.FORBIDDEN,
      );
    }

    // HEADGLOBAL может сохранять только свою роль
    if (user.role === UserRoles.HEADGLOBAL) {
      // Получаем текущие настройки
      const setting = await this.settingsService.getSettingByKey(
        "global.menuVisibility",
      );
      const currentSettings = setting?.value || {};

      // Объединяем текущие настройки с новыми (HEADGLOBAL может изменить только свою роль)
      // Убеждаемся, что currentSettings является объектом
      const mergedSettings = {
        ...(typeof currentSettings === "object" &&
        currentSettings !== null &&
        !Array.isArray(currentSettings)
          ? currentSettings
          : {}),
        [UserRoles.HEADGLOBAL]: menuVisibility[UserRoles.HEADGLOBAL],
      };

      if (setting) {
        // Обновляем существующую настройку
        return this.settingsService.updateSetting(setting.id, {
          value: mergedSettings,
        });
      } else {
        // Создаем новую настройку
        return this.settingsService.createSetting({
          key: "global.menuVisibility",
          type: SettingType.JSON,
          value: mergedSettings,
          description: "Глобальные настройки видимости меню для GLOBAL ролей",
          allowedRoles: [
            UserRoles.ADMINGLOBAL,
            UserRoles.KASSIRGLOBAL,
            UserRoles.HEADGLOBAL,
          ],
          enterpriseId: null,
        });
      }
    }

    // Для других ролей проверяем права на редактирование
    if (!canEditGlobalSettings(user.role)) {
      throw new HttpException(
        "Нет прав на редактирование глобальных настроек",
        HttpStatus.FORBIDDEN,
      );
    }

    // Получаем или создаем настройку
    const setting = await this.settingsService.getSettingByKey(
      "global.menuVisibility",
    );

    if (setting) {
      // Обновляем существующую настройку
      return this.settingsService.updateSetting(setting.id, {
        value: menuVisibility,
      });
    } else {
      // Создаем новую настройку
      return this.settingsService.createSetting({
        key: "global.menuVisibility",
        type: SettingType.JSON,
        value: menuVisibility,
        description: "Глобальные настройки видимости меню для GLOBAL ролей",
        allowedRoles: [UserRoles.ADMINGLOBAL, UserRoles.KASSIRGLOBAL],
        enterpriseId: null,
      });
    }
  }

  @Get("registry/available-items")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Получить все доступные элементы для настроек интерфейса",
  })
  @ApiResponse({ status: 200, description: "Список всех доступных элементов" })
  async getAvailableItems() {
    return this.registryService.getAllAvailableItems();
  }

  // --- Периодические значения настроек ---

  @Get(":id/pereodic")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Получить все периодические значения настройки",
  })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Список периодических значений",
    type: [SettingPereodic],
  })
  async getSettingPereodicValues(
    @Param("id", ParseIntPipe) id: number,
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<SettingPereodic[]> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getSettingPereodicValues(
      id,
      parsedEnterpriseId,
    );
  }

  @Get(":id/pereodic/forDate")
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Получить значение периодической настройки на дату",
  })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiQuery({ name: "date", required: true, type: Number })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Значение на дату (число)",
  })
  async getSettingPereodicValueForDate(
    @Param("id", ParseIntPipe) id: number,
    @Query("date") date: string,
    @Query("enterpriseId") enterpriseId?: string,
  ): Promise<number> {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.settingsService.getSettingPereodicValueForDate(
      id,
      Number(date),
      parsedEnterpriseId,
    );
  }

  @Post(":id/pereodic")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Создать периодическое значение настройки" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiResponse({
    status: 201,
    description: "Периодическое значение создано",
    type: SettingPereodic,
  })
  async createSettingPereodic(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCreateSettingPereodicDto,
  ): Promise<SettingPereodic> {
    dto.settingId = id;
    return this.settingsService.createSettingPereodic(dto);
  }

  @Put(":id/pereodic/:pId")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Обновить периодическое значение настройки" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiParam({
    name: "pId",
    description: "ID периодического значения",
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Периодическое значение обновлено",
    type: SettingPereodic,
  })
  async updateSettingPereodic(
    @Param("id", ParseIntPipe) id: number,
    @Param("pId", ParseIntPipe) pId: number,
    @Body() dto: UpdateCreateSettingPereodicDto,
  ): Promise<SettingPereodic | null> {
    dto.settingId = id;
    return this.settingsService.updateSettingPereodic(pId, dto);
  }

  @Delete(":id/pereodic/:pId")
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Удалить периодическое значение настройки" })
  @ApiParam({ name: "id", description: "ID настройки", type: "number" })
  @ApiParam({
    name: "pId",
    description: "ID периодического значения",
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Периодическое значение удалено",
  })
  async deleteSettingPereodic(
    @Param("pId", ParseIntPipe) pId: number,
  ): Promise<SettingPereodic | null> {
    return this.settingsService.deleteSettingPereodic(pId);
  }
}
