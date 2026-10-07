import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ReferencesService } from "./references.service";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Reference } from "./reference.model";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import {
  TypeReference,
  TypeTMZ,
  isTmzAttributeDictionaryType,
} from "src/interfaces/reference.interface";
import { UpdateCreateReferenceDto } from "./dto/updateCreateReference.dto";
import { CreateManyReferencesDto } from "./dto/createManyReferences.dto";
import { CurrentUser } from "src/common/decorators/current-enterprise.decorator";
import {
  canCreateReference,
  canEditReference,
} from "src/common/referencePermissions.util";
import { UserRoles } from "src/interfaces/user.interface";
import { UsersService } from "src/users/users.service";

@ApiTags("Справочники")
@Controller("references")
export class ReferencesController {
  constructor(
    private referencesService: ReferencesService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({ summary: "Получение всех справочников" })
  @ApiResponse({ status: 200, type: [Reference] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("all")
  getAll() {
    const refs = this.referencesService.getAllReferences();
    return refs;
  }

  @ApiOperation({
    summary: "Получение справочников по типу",
    description:
      "slim=1 — лёгкий ответ (id, name, isFolder, enterpriseId + минимум refValues) для селектов словарей ТМЗ",
  })
  @ApiResponse({ status: 200, type: [Reference] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("byType/:typeReference")
  getByType(
    @Param("typeReference") typeReference: TypeReference,
    @Query("enterpriseId") enterpriseId?: string,
    @Query("sourceEnterpriseId") sourceEnterpriseId?: string,
    @Query("slim") slim?: string,
    @CurrentUser() user?: any,
  ) {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    const parsedSourceEnterpriseId =
      sourceEnterpriseId !== undefined ? Number(sourceEnterpriseId) : undefined;
    const userRole = user?.role;
    const userEnterpriseId = user?.enterpriseId;
    const slimMode = slim === "1" || slim === "true";
    return this.referencesService.getReferenceByType(
      typeReference,
      parsedEnterpriseId,
      userRole,
      userEnterpriseId,
      parsedSourceEnterpriseId,
      slimMode,
    );
  }

  @ApiOperation({
    summary: "Следующий артикул TMZ по префиксу (предпросмотр до сохранения)",
  })
  @ApiResponse({ status: 200, description: "{ article: string }" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("tmz/next-article")
  nextTmzArticle(
    @Query("prefix") prefix?: string,
    @Query("enterpriseId") enterpriseId?: string,
    @Query("excludeId") excludeId?: string,
  ) {
    const entRaw =
      enterpriseId != null && enterpriseId !== ""
        ? Number(enterpriseId)
        : null;
    const ent =
      entRaw != null && Number.isFinite(entRaw) ? entRaw : null;
    const excludeRaw =
      excludeId != null && excludeId !== "" ? Number(excludeId) : undefined;
    const exclude =
      excludeRaw != null && Number.isFinite(excludeRaw)
        ? excludeRaw
        : undefined;
    return this.referencesService
      .previewNextTmzArticle(prefix ?? "", ent, exclude)
      .then((article) => ({ article }));
  }

  @ApiOperation({
    summary: "Следующий артикул WORKS по группе (предпросмотр до сохранения)",
  })
  @ApiResponse({ status: 200, description: "{ article: string }" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("works/next-article")
  nextWorksArticle(
    @Query("prefix") prefix?: string,
    @Query("enterpriseId") enterpriseId?: string,
    @Query("excludeId") excludeId?: string,
  ) {
    const entRaw =
      enterpriseId != null && enterpriseId !== ""
        ? Number(enterpriseId)
        : null;
    const ent =
      entRaw != null && Number.isFinite(entRaw) ? entRaw : null;
    const excludeRaw =
      excludeId != null && excludeId !== "" ? Number(excludeId) : undefined;
    const exclude =
      excludeRaw != null && Number.isFinite(excludeRaw)
        ? excludeRaw
        : undefined;
    return this.referencesService
      .previewNextWorksArticle(prefix ?? "", ent, exclude)
      .then((article) => ({ article }));
  }

  @ApiOperation({ summary: "Получение справочника по id" })
  @ApiResponse({ status: 200, type: Reference })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/:id")
  getById(@Param("id") id: number) {
    return this.referencesService.getReferenceById(id);
  }

  @ApiOperation({ summary: "Обновить справочник" })
  @ApiResponse({ status: 200, type: Reference })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Patch(":id")
  async updateReference(
    @Param("id") id: number,
    @Body() dto: UpdateCreateReferenceDto,
    @CurrentUser() user: any,
  ) {
    const userRole = user?.role;

    // Получаем справочник для проверки типа
    const existingReference = await this.referencesService.getReferenceById(id);
    if (!existingReference) {
      throw new HttpException("Справочник не найден", HttpStatus.NOT_FOUND);
    }

    const referenceType = dto.typeReference || existingReference.typeReference;

    const dbUser = user?.email
      ? await this.usersService.getUserByEmail(user.email)
      : null;
    if (
      !canEditReference(
        dbUser?.referencePermissions ?? null,
        userRole,
        referenceType,
      )
    ) {
      throw new HttpException(
        "Нет доступа к созданию справочника",
        HttpStatus.FORBIDDEN,
      );
    }

    // Для HEADGLOBAL: TMZ и словари реквизитов ТМЗ
    if (userRole === UserRoles.HEADGLOBAL) {
      if (
        referenceType !== TypeReference.TMZ &&
        !isTmzAttributeDictionaryType(referenceType)
      ) {
        throw new HttpException(
          "HEADGLOBAL может редактировать только справочники TMZ и их реквизитов",
          HttpStatus.FORBIDDEN,
        );
      }
      if (referenceType === TypeReference.TMZ) {
        dto.enterpriseId = null;
      }
    }

    return this.referencesService.updateReferenceById(
      id,
      dto,
      userRole,
      user?.enterpriseId,
      true, // canEditReference already passed (including TMZ canEdit from user settings)
    );
  }

  @ApiOperation({ summary: "Открыть нового справочники" })
  @ApiResponse({ status: 200, type: Reference })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Post("/create")
  async createReference(
    @Body() dto: UpdateCreateReferenceDto,
    @CurrentUser() user: any,
  ) {
    const userRole = user?.role;
    const userSuperKassir = user?.superKassir === true;
    const isPartnersWorkersCharges =
      dto.typeReference === TypeReference.PARTNERS ||
      dto.typeReference === TypeReference.WORKERS ||
      dto.typeReference === TypeReference.CHARGES ||
      dto.typeReference === TypeReference.SERVICES;

    const dbUser = user?.email
      ? await this.usersService.getUserByEmail(user.email)
      : null;
    if (
      !canCreateReference(
        dbUser?.referencePermissions ?? null,
        userRole,
        dto.typeReference,
      )
    ) {
      throw new HttpException(
        "Нет доступа к созданию справочника",
        HttpStatus.FORBIDDEN,
      );
    }

    // Для HEADGLOBAL: TMZ и словари реквизитов ТМЗ
    if (userRole === UserRoles.HEADGLOBAL) {
      if (
        dto.typeReference !== TypeReference.TMZ &&
        !isTmzAttributeDictionaryType(dto.typeReference)
      ) {
        throw new HttpException(
          "HEADGLOBAL может создавать только справочники TMZ и их реквизитов",
          HttpStatus.FORBIDDEN,
        );
      }
      if (dto.typeReference === TypeReference.TMZ) {
        dto.enterpriseId = null;
      }
    }

    // Для кассиров: разрешаем создание справочников только если включен superKassir и только для PARTNERS/WORKERS/CHARGES
    if (
      (userRole === UserRoles.KASSIR || userRole === UserRoles.KASSIRGLOBAL) &&
      (!userSuperKassir || !isPartnersWorkersCharges)
    ) {
      throw new HttpException(
        "Нет доступа к созданию справочника",
        HttpStatus.FORBIDDEN,
      );
    }

    // Для ADMINGLOBAL устанавливаем enterpriseId = null, так как у ADMINGLOBAL нет своей организации
    if (userRole === UserRoles.ADMINGLOBAL) {
      dto.enterpriseId = null;
    }
    // TMZ без HEADGLOBAL: карточка на предприятие пользователя (DRAWING и др.)
    else if (
      dto.typeReference === TypeReference.TMZ &&
      userRole !== UserRoles.HEADGLOBAL &&
      user?.enterpriseId
    ) {
      dto.enterpriseId = user.enterpriseId;
    }
    // Для пользователей с superKassir разрешаем создание справочников для других организаций только для PARTNERS/WORKERS/CHARGES
    else if (
      userSuperKassir &&
      isPartnersWorkersCharges &&
      dto.enterpriseId !== undefined &&
      dto.enterpriseId !== null
    ) {
      // Разрешаем использовать переданный enterpriseId
      // Ничего не меняем, используем значение из DTO
    } else if (
      !dto.enterpriseId &&
      user?.enterpriseId &&
      userRole !== UserRoles.HEADGLOBAL
    ) {
      // Автоматически устанавливаем enterpriseId из пользователя, если не указан в DTO
      // Исключаем MAGAZINE и HEADGLOBAL, так как для них уже установили null выше
      dto.enterpriseId = user.enterpriseId;
    }
    return this.referencesService.createReference(
      dto,
      userRole,
      user?.enterpriseId,
      userSuperKassir,
      { allowByReferencePermission: true },
    );
  }

  @ApiOperation({
    summary:
      "Массовое создание справочников (кэш обновляется один раз в конце)",
  })
  @ApiResponse({ status: 200 })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Post("/create-bulk")
  async createManyReferences(
    @Body() body: CreateManyReferencesDto,
    @CurrentUser() user: any,
  ) {
    const userRole = user?.role;
    const userSuperKassir = user?.superKassir === true;
    const items = body?.items ?? [];
    if (!items.length) {
      throw new HttpException("Список items пуст", HttpStatus.BAD_REQUEST);
    }

    const dbUser = user?.email
      ? await this.usersService.getUserByEmail(user.email)
      : null;

    for (const dto of items) {
      if (
        !canCreateReference(
          dbUser?.referencePermissions ?? null,
          userRole,
          dto.typeReference,
        )
      ) {
        throw new HttpException(
          `Нет доступа к созданию справочника типа ${dto.typeReference}`,
          HttpStatus.FORBIDDEN,
        );
      }

      const isPartnersWorkersCharges =
        dto.typeReference === TypeReference.PARTNERS ||
        dto.typeReference === TypeReference.WORKERS ||
        dto.typeReference === TypeReference.CHARGES ||
        dto.typeReference === TypeReference.SERVICES;

      if (
        (userRole === UserRoles.KASSIR || userRole === UserRoles.KASSIRGLOBAL) &&
        (!userSuperKassir || !isPartnersWorkersCharges)
      ) {
        throw new HttpException(
          "Нет доступа к созданию справочника",
          HttpStatus.FORBIDDEN,
        );
      }

      if (userRole === UserRoles.ADMINGLOBAL) {
        dto.enterpriseId = null;
      } else if (
        dto.typeReference === TypeReference.TMZ &&
        userRole !== UserRoles.HEADGLOBAL &&
        user?.enterpriseId
      ) {
        dto.enterpriseId = user.enterpriseId;
      } else if (
        userSuperKassir &&
        isPartnersWorkersCharges &&
        dto.enterpriseId !== undefined &&
        dto.enterpriseId !== null
      ) {
        // keep dto.enterpriseId
      } else if (
        !dto.enterpriseId &&
        user?.enterpriseId &&
        userRole !== UserRoles.HEADGLOBAL
      ) {
        dto.enterpriseId = user.enterpriseId;
      }
    }

    return this.referencesService.createManyReferences(
      items,
      userRole,
      user?.enterpriseId,
      userSuperKassir,
      true,
    );
  }

  @ApiOperation({
    summary:
      "Дублировать справочник (копия карточки и норм готовой продукции)",
  })
  @ApiResponse({ status: 200, type: Reference })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.GLAVBUX,
    UserRoles.HEADGLOBAL,
  )
  @UseGuards(RolesGuard)
  @Post(":id/duplicate")
  duplicateReference(@Param("id") id: number, @CurrentUser() user: any) {
    return this.referencesService.duplicateReference(
      id,
      user?.role,
      user?.enterpriseId,
    );
  }

  @ApiOperation({ summary: "Пометить на удаление справочника" })
  @ApiResponse({ status: 200, type: Reference })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Delete("markToDelete/:id")
  markToDelete(@Param("id") id: number, @CurrentUser() user: any) {
    const userRole = user?.role;
    return this.referencesService.markToDeleteById(id, userRole);
  }

  @ApiOperation({
    summary:
      "Полностью удалить из БД партнёров, импортированных из Excel (importedFromXlsx), вместе с их договорами аренды",
  })
  @ApiResponse({ status: 200 })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  @Post("delete-imported-permanent")
  deleteImportedPermanent(@CurrentUser() user: any) {
    return this.referencesService.deleteImportedPartnersPermanent(user?.role);
  }

  @ApiOperation({ summary: "Получить вхождения справочника" })
  @ApiResponse({ status: 200, description: "Связи в справочниках и документах" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get(":id/usage")
  getReferenceUsage(@Param("id") id: number) {
    return this.referencesService.getReferenceUsage(id);
  }

  @ApiOperation({
    summary:
      "Удалить справочник полностью, если нет связей в справочниках и документах",
  })
  @ApiResponse({ status: 200, description: "Результат полного удаления" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Delete(":id/permanent")
  deleteReferencePermanent(@Param("id") id: number, @CurrentUser() user: any) {
    const userRole = user?.role;
    return this.referencesService.deleteReferencePermanentById(id, userRole);
  }

  @ApiOperation({ summary: "Проверить существование справочника" })
  @ApiResponse({
    status: 200,
    description: "Возвращает true если справочник существует",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("checkExists/:name/:typeReference")
  checkExists(
    @Param("name") name: string,
    @Param("typeReference") typeReference: TypeReference,
    @Query("enterpriseId") enterpriseId?: string,
  ) {
    const parsedEnterpriseId =
      enterpriseId !== undefined ? Number(enterpriseId) : undefined;
    return this.referencesService.checkReferenceExists(
      name,
      typeReference,
      parsedEnterpriseId,
    );
  }
}
