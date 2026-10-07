import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  Logger,
} from "@nestjs/common";
import { Document } from "src/documents/document.model";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/auth/roles-auth.decorator";
import { DocumentsService } from "./documents.service";
import { RolesGuard } from "src/auth/roles.guard";
import { UserRoles } from "src/interfaces/user.interface";
import { DocumentType } from "src/interfaces/document.interface";
import { UpdateCreateDocumentDto } from "./dto/updateCreateDocument.dto";
import { Request } from "express";
import { UsersService } from "src/users/users.service";
import { ReferencesService } from "src/references/references.service";
import { DOCUMENT_NOT_FOUND_ERROR } from "./document.constants";
import {
  DocumentActionDto,
  RejectDocumentDto,
  AcceptDocumentDto,
} from "./dto/document-action.dto";
import {
  CurrentEnterprise,
  CurrentUser,
} from "src/common/decorators/current-enterprise.decorator";
import { assertZavskladDocumentAccess } from "./helper/zavskladDocuments.helper";

@Controller("documents")
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private documentsService: DocumentsService,
    private usersService: UsersService,
    private referencesService: ReferencesService,
  ) {}

  @ApiOperation({ summary: "Получение всех документов" })
  @ApiResponse({ status: 200, type: [Document] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("all")
  getAll(
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    // Для ADMINGLOBAL всегда используем режим суперпользователя, чтобы видеть все документы
    const isSuperUser =
      user?.isSuperUser || user?.role === UserRoles.ADMINGLOBAL;
    return this.documentsService.getAllDocuments(
      enterpriseId ?? undefined,
      isSuperUser,
    );
  }

  @ApiOperation({ summary: "Получение всех документов по типу" })
  @ApiResponse({ status: 200, type: [Document] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("byType/:typeDocument")
  getAllByType(
    @Param("typeDocument") typeDocument: DocumentType,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    // Для ADMINGLOBAL всегда используем режим суперпользователя, чтобы видеть все документы
    const isSuperUser =
      user?.isSuperUser || user?.role === UserRoles.ADMINGLOBAL;
    return this.documentsService.getAllDocumentsByType(
      typeDocument,
      enterpriseId ?? undefined,
      isSuperUser,
    );
  }

  @ApiOperation({ summary: "Получение документов по типу и по дате" })
  @ApiResponse({ status: 200, type: [Document] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("byTypeForDate")
  async getByTypeForDate(
    @Req() request: Request,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    const documentType = request.query?.documentType
      ? request.query?.documentType
      : "";
    const dateStart = request.query?.dateStart ? +request.query?.dateStart : 0;
    const dateEnd = request.query?.dateEnd ? +request.query?.dateEnd : 0;
    // Для ADMINGLOBAL всегда используем режим суперпользователя, чтобы видеть все документы
    const isSuperUser =
      user?.isSuperUser || user?.role === UserRoles.ADMINGLOBAL;
    const documents = await this.documentsService.getAllDocumentsByTypeForDate(
      documentType,
      dateStart,
      dateEnd,
      enterpriseId ?? undefined,
      isSuperUser,
    );

    return documents;
  }

  @ApiOperation({
    summary:
      "Получение документов MoveMaterial по выбранному предприятию и периоду (для superKassir)",
  })
  @ApiResponse({ status: 200, type: [Document] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("move-material/byTypeForDate")
  async getMoveMaterialByEnterpriseAndDate(
    @Req() request: Request,
    @CurrentUser() user: any,
  ) {
    // Проверяем, что у пользователя включен флаг superKassir
    if (!user?.superKassir) {
      throw new HttpException(
        "Нет доступа к просмотру документов других предприятий",
        HttpStatus.FORBIDDEN,
      );
    }

    const targetEnterpriseId = request.query?.enterpriseId
      ? +request.query.enterpriseId
      : null;
    const dateStart = request.query?.dateStart ? +request.query.dateStart : 0;
    const dateEnd = request.query?.dateEnd ? +request.query.dateEnd : 0;

    if (!targetEnterpriseId) {
      throw new HttpException(
        "Не указано предприятие для просмотра",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Возвращаем MoveMaterial документы для выбранного предприятия
    const documents = await this.documentsService.getAllDocumentsByTypeForDate(
      DocumentType.MoveMaterial,
      dateStart,
      dateEnd,
      targetEnterpriseId,
      false, // Не используем режим суперпользователя, фильтруем строго по enterpriseId
    );

    return documents;
  }

  @ApiOperation({ summary: "Метаданные журнала по типу документа" })
  @ApiResponse({ status: 200 })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("journal-meta")
  async getJournalMeta(
    @Query("documentType") documentType: string,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    if (!documentType || !Object.values(DocumentType).includes(documentType as DocumentType)) {
      throw new BadRequestException("Некорректный тип документа");
    }

    const isSuperUser =
      user?.isSuperUser || user?.role === UserRoles.ADMINGLOBAL;

    return this.documentsService.getJournalMeta(
      documentType as DocumentType,
      enterpriseId ?? undefined,
      isSuperUser,
    );
  }

  @ApiOperation({ summary: "Получение документов по типу и по дате" })
  @ApiResponse({ status: 200, type: [Document] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("byDate")
  async getAllDocsByDate(
    @Req() request: Request,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    const dateStart = request.query?.dateStart ? +request.query?.dateStart : 0;
    const dateEnd = request.query?.dateEnd ? +request.query?.dateEnd : 0;
    // Для ADMINGLOBAL всегда используем режим суперпользователя, чтобы видеть все документы
    const isSuperUser =
      user?.isSuperUser || user?.role === UserRoles.ADMINGLOBAL;
    const documents = await this.documentsService.getAllDocsByDate(
      dateStart,
      dateEnd,
      enterpriseId ?? undefined,
      isSuperUser,
    );
    return documents;
  }

  @ApiOperation({
    summary: "Найти склад PARTNER_TOOLS по партнёру",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("sublease-partner-storage")
  async getSubleasePartnerStorage(
    @Query("partnerId") partnerId: string,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const partner = Number(partnerId);
    if (!partner) {
      throw new BadRequestException("partnerId обязателен");
    }
    const storage = await this.documentsService.resolvePartnerToolsStorage(
      partner,
      enterpriseId,
    );
    if (!storage) {
      throw new BadRequestException(
        "Склад субаренды (PARTNER_TOOLS) для партнёра не найден. Создайте склад и укажите партнёра.",
      );
    }
    return { id: storage.id, name: storage.name };
  }

  @ApiOperation({ summary: "Буюртмалар, которые можно закрыть текущим остатком S11" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("rental-orders/ready")
  async getReadyRentalOrders(
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    return this.documentsService.getReadyRentalOrders(enterpriseId);
  }

  @ApiOperation({ summary: "Создать Топшириш из буюртмы" })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.GLAVBUX,
    UserRoles.KASSIR,
    UserRoles.KASSIRGLOBAL,
    UserRoles.ZAVSKLAD,
  )
  @UseGuards(RolesGuard)
  @Post("rental-orders/:id/create-transfer")
  async createTransferFromRentalOrder(
    @Param("id") id: string,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const orderId = Number(id);
    const userId = Number(user?.id) || 0;
    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new BadRequestException("Некорректный id буюртмы");
    }
    if (!userId) {
      throw new BadRequestException("Не удалось определить пользователя");
    }
    try {
      return await this.documentsService.createTransferFromRentalOrder(
        orderId,
        enterpriseId,
        userId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        error?.message || "Топшириш яратишда хатолик",
      );
    }
  }

  @ApiOperation({ summary: "Получение документа по id" })
  @ApiResponse({ status: 200, type: Document })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/:id")
  getById(
    @Param("id") id: string,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    const documentId = Number(id);
    if (!Number.isFinite(documentId) || documentId <= 0) {
      throw new BadRequestException("Некорректный id документа");
    }
    return this.documentsService.getDocumentById(
      documentId,
      enterpriseId ?? undefined,
    );
  }

  @ApiOperation({ summary: "Обновить документ" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.GLAVBUX,
    UserRoles.KASSIR,
    UserRoles.KASSIRGLOBAL,
    UserRoles.ZAVSKLAD,
  )
  @UseGuards(RolesGuard)
  @Patch("update/:id")
  async updateDocument(
    @Param("id") id: number,
    @Body() dto: UpdateCreateDocumentDto,
    @CurrentUser() user: any,
  ) {
    try {
      const existing = await this.documentsService.getDocumentById(id);
      if (!existing) {
        throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
      }
      assertZavskladDocumentAccess(user?.role, existing.documentType);
      if (dto.documentType) {
        assertZavskladDocumentAccess(user?.role, dto.documentType);
      }

      // Логирование для отладки analiticId
      if (dto.docValues?.analiticId !== undefined) {
        this.logger.log(
          `[UPDATE] docValues.analiticId - Type: ${typeof dto.docValues.analiticId}, Value: ${dto.docValues.analiticId}, JSON: ${JSON.stringify(dto.docValues.analiticId)}`,
        );
      } else {
        this.logger.log(`[UPDATE] docValues.analiticId - undefined or null`);
      }

      // Логируем входящие данные для диагностики
      this.logger.log(
        `[UPDATE] Обновление документа ID: ${id}, docTableItems: ${dto.docTableItems?.length || 0}`,
      );

      const updatedDocument = await this.documentsService.updateDocumentById(
        id,
        dto,
      );

      if (!updatedDocument) {
        throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
      }

      return updatedDocument;
    } catch (error) {
      // Логируем полную ошибку для диагностики
      this.logger.error(
        `[UPDATE] Ошибка обновления документа ID: ${id}`,
        error.stack || error.message,
      );

      // Если это уже HttpException, пробрасываем его дальше
      if (error instanceof HttpException) {
        throw error;
      }

      // Для других ошибок возвращаем BadRequest с понятным сообщением
      throw new BadRequestException(
        error.message || "Ошибка при обновлении документа",
      );
    }
  }

  @ApiOperation({ summary: "Открыть новый документ" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.GLAVBUX,
    UserRoles.KASSIR,
    UserRoles.KASSIRGLOBAL,
    UserRoles.ZAVSKLAD,
  )
  @UseGuards(RolesGuard)
  @Post("/create")
  async createDocument(
    @Body() dto: UpdateCreateDocumentDto,
    @CurrentUser() user: any,
  ) {
    try {
      assertZavskladDocumentAccess(user?.role, dto.documentType);
      const jwtUserId = Number(user?.id) || 0;
      if (!jwtUserId) {
        throw new BadRequestException(
          "Не удалось определить пользователя сессии (userId)",
        );
      }
      this.logger.log(`[CREATE] Создание документа типа: ${dto.documentType}`);
      const newDoc = await this.documentsService.createDocument(
        { ...dto, userId: jwtUserId },
        this.usersService,
        this.referencesService,
      );
      this.logger.log(`[CREATE] Документ создан успешно, ID: ${newDoc?.id}`);
      return newDoc;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `[CREATE] Ошибка при создании документа: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || "Ошибка при создании документа",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: "Пометить на удаление документа" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.KASSIRGLOBAL,
    UserRoles.KASSIR,
    UserRoles.GLAVBUX,
    UserRoles.HEADGLOBAL,
    UserRoles.ZAVSKLAD,
  )
  @UseGuards(RolesGuard)
  @Delete("markToDelete/:id")
  async markToDelete(
    @Param("id") id: number,
    @Query("reopen") reopen: string | undefined,
    @CurrentUser() user: any,
  ) {
    const existing = await this.documentsService.getDocumentById(id);
    if (!existing) {
      throw new HttpException(DOCUMENT_NOT_FOUND_ERROR, HttpStatus.NOT_FOUND);
    }
    assertZavskladDocumentAccess(user?.role, existing.documentType);

    const reopenFlag = reopen === "true" || reopen === "1";
    const markedDoc = await this.documentsService.markToDeleteById(
      id,
      undefined,
      user?.id,
      reopenFlag,
    );
    if (!markedDoc) {
      throw new HttpException(DOCUMENT_NOT_FOUND_ERROR, HttpStatus.NOT_FOUND);
    }

    return markedDoc;
  }

  @ApiOperation({ summary: "Удалить документ полностью" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.KASSIRGLOBAL,
    UserRoles.KASSIR,
    UserRoles.GLAVBUX,
    UserRoles.HEADGLOBAL,
  )
  @UseGuards(RolesGuard)
  @Delete("permanent/:id")
  async deletePermanent(@Param("id") id: number, @CurrentUser() user: any) {
    return this.documentsService.deleteDocumentPermanentById(id, user?.id);
  }

  @ApiOperation({ summary: "Дать проводку на документ" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.KASSIR,
    UserRoles.GLAVBUX,
    UserRoles.ZAVSKLAD,
  )
  @UseGuards(RolesGuard)
  @Patch("setProvodka/:id")
  async setProvodka(
    @Param("id") id: number,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    const existing = await this.documentsService.getDocumentById(
      id,
      enterpriseId ?? undefined,
    );
    if (!existing) {
      throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
    }
    assertZavskladDocumentAccess(user?.role, existing.documentType);

    const docForProvodka = await this.documentsService.setProvodka(id);
    if (!docForProvodka) {
      throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
    }

    return docForProvodka;
  }

  @Post(":id/send")
  @ApiOperation({ summary: "Отправить межпредприятийный документ" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  sendDocument(@Param("id") id: string, @Body() dto: DocumentActionDto) {
    return this.documentsService.sendInterEnterpriseDocument(
      Number(id),
      dto.enterpriseId,
    );
  }

  @Post(":id/cancel-sending")
  @ApiOperation({ summary: "Отменить отправку межпредприятийного документа" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  cancelSending(
    @Param("id") id: string,
    @Body() dto: DocumentActionDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.cancelInterEnterpriseSending(
      Number(id),
      dto.enterpriseId,
      user?.id,
    );
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Принять межпредприятийный документ" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  acceptDocument(
    @Param("id") id: string,
    @Body() dto: AcceptDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.acceptInterEnterpriseDocument(
      Number(id),
      dto.enterpriseId,
      user?.id,
    );
  }

  @Post(":id/approve-internal")
  @ApiOperation({
    summary: "Утвердить внутренний документ (HEADGLOBAL / ADMINGLOBAL)",
  })
  @Roles(UserRoles.ADMINGLOBAL, UserRoles.HEADGLOBAL)
  @UseGuards(RolesGuard)
  approveInternalDocument(@Param("id") id: string, @CurrentUser() user: any) {
    return this.documentsService.approveInternalDocument(Number(id), user?.id);
  }

  @Post(":id/send-to-pending")
  @ApiOperation({
    summary: "Отправить внутренний документ в PENDING для утверждения",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  sendInternalDocumentToPending(
    @Param("id") id: string,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("Enterprise ID is required");
    }
    return this.documentsService.sendInternalDocumentToPending(
      Number(id),
      enterpriseId,
    );
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Отклонить межпредприятийный документ" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  rejectDocument(@Param("id") id: string, @Body() dto: RejectDocumentDto) {
    return this.documentsService.rejectInterEnterpriseDocument(
      Number(id),
      dto.enterpriseId,
      dto.reason,
    );
  }

  @Post(":id/return-to-work")
  @ApiOperation({
    summary: "Вернуть отклонённый межпредприятийный документ в работу",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  returnToWork(@Param("id") id: string, @Body() dto: DocumentActionDto) {
    return this.documentsService.returnInterEnterpriseDocumentToWork(
      Number(id),
      dto.enterpriseId,
    );
  }

  @Post(":id/cancel-provodka")
  @ApiOperation({
    summary:
      "Отменить проводки межпредприятийного документа. Доступно только для ADMINGLOBAL",
  })
  @Roles(UserRoles.ADMINGLOBAL)
  @UseGuards(RolesGuard)
  cancelProvodka(
    @Param("id") id: string,
    @CurrentUser() user: any,
  ) {
    console.log(
      `[cancelProvodka] Запрос на отмену проводки для документа ${id}, userId: ${user?.id}, role: ${user?.role}`,
    );
    this.logger.log(
      `[cancelProvodka] Запрос на отмену проводки для документа ${id}, userId: ${user?.id}, role: ${user?.role}`,
    );
    const isSuperUser = user?.role === UserRoles.ADMINGLOBAL;
    console.log(
      `[cancelProvodka] isSuperUser: ${isSuperUser}, вызываем cancelInterEnterpriseProvodka`,
    );
    this.logger.log(
      `[cancelProvodka] isSuperUser: ${isSuperUser}, вызываем cancelInterEnterpriseProvodka`,
    );
    return this.documentsService.cancelInterEnterpriseProvodka(
      Number(id),
      isSuperUser,
    );
  }

  @ApiOperation({ summary: "Предпросмотр строк амортизации ОС" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("amortizasiya-os/preview")
  async getAmortizasiyaOsPreview(
    @Query("storageId") storageId: string,
    @Query("docDate") docDate: string,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const storage = Number(storageId);
    const dateMs = Number(docDate);
    if (!storage || !dateMs) {
      throw new BadRequestException("storageId и docDate обязательны");
    }
    return this.documentsService.getAmortizasiyaOsPreview(
      storage,
      dateMs,
      enterpriseId,
    );
  }

  @ApiOperation({ summary: "Предпросмотр строк возврата инструментов (FIFO)" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("receive-tools/preview")
  async getReceiveToolsPreview(
    @Query("clientId") clientId: string,
    @Query("warehouseId") warehouseId: string,
    @Query("returnDate") returnDate: string,
    @Query("excludeDocId") excludeDocId: string | undefined,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const client = Number(clientId);
    const warehouse = Number(warehouseId);
    const returnDateTime = Number(returnDate);
    if (!client || !warehouse || !returnDateTime) {
      throw new BadRequestException(
        "clientId, warehouseId и returnDate обязательны",
      );
    }
    return this.documentsService.getReceiveToolsPreview(
      client,
      warehouse,
      returnDateTime,
      enterpriseId,
      excludeDocId ? Number(excludeDocId) : undefined,
    );
  }

  @ApiOperation({
    summary: "Предпросмотр остатков инструментов на складе (S11) для передачи клиенту",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("transfer-tools/preview")
  async getTransferToolsPreview(
    @Query("warehouseId") warehouseId: string,
    @Query("date") date: string,
    @Query("rentTariffType") rentTariffType: string | undefined,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const warehouse = Number(warehouseId);
    const documentDate = Number(date);
    if (!warehouse || !documentDate) {
      throw new BadRequestException("warehouseId и date обязательны");
    }
    return this.documentsService.getTransferToolsPreview(
      warehouse,
      documentDate,
      enterpriseId,
      rentTariffType,
    );
  }

  @ApiOperation({
    summary: "Предпросмотр открытых партий субаренды для возврата",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("sublease-receive/preview")
  async getSubleaseReceivePreview(
    @Query("clientId") clientId: string,
    @Query("returnDate") returnDate: string,
    @Query("partnerId") partnerId: string | undefined,
    @Query("excludeDocId") excludeDocId: string | undefined,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    if (!enterpriseId) {
      throw new BadRequestException("enterpriseId обязателен");
    }
    const client = Number(clientId);
    const returnDateTime = Number(returnDate);
    if (!client || !returnDateTime) {
      throw new BadRequestException("clientId и returnDate обязательны");
    }
    return this.documentsService.getSubleaseReceivePreview(
      client,
      returnDateTime,
      enterpriseId,
      partnerId ? Number(partnerId) : undefined,
      excludeDocId ? Number(excludeDocId) : undefined,
    );
  }

  @Post(":id/recalculate-costs")
  @ApiOperation({ summary: "Пересчитать себестоимость для документа SaleProd" })
  @ApiResponse({ status: 200, type: Document })
  @Roles(
    UserRoles.ADMINGLOBAL,
    UserRoles.HEADCOMPANY,
    UserRoles.GLAVBUX,
    UserRoles.KASSIR,
    UserRoles.KASSIRGLOBAL,
  )
  @UseGuards(RolesGuard)
  async recalculateCosts(@Param("id") id: string) {
    try {
      const documentId = parseInt(id, 10);
      const updatedDocument =
        await this.documentsService.recalculateSaleProdCosts(documentId);
      return updatedDocument;
    } catch (error) {
      this.logger.error(
        `[RECALCULATE-COSTS] Ошибка пересчета себестоимости для документа ID: ${id}`,
        error.stack || error.message,
      );
      throw new HttpException(
        error.message || "Ошибка при пересчете себестоимости",
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
