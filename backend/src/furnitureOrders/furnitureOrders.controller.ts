import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { FurnitureOrdersService } from "./furnitureOrders.service";
import { CreateFurnitureOrderDto } from "./dto/create-furniture-order.dto";
import { UpdateFurnitureOrderDto } from "./dto/update-furniture-order.dto";
import { AdvanceStageDto } from "./dto/advance-stage.dto";
import { RevertStageDto } from "./dto/revert-stage.dto";
import { UpdateProductionQueueDto } from "./dto/update-production-queue.dto";
import { OrderStageType } from "src/interfaces/furniture-order.interface";
import { OrderStoreWorkService } from "./order-store-work.service";
import { StoreWorkActionDto } from "./dto/store-work-action.dto";
import { StoreWriteoffProveDto } from "./dto/store-writeoff-prove.dto";
import { StoreMaterialWriteoffDto } from "./dto/store-material-writeoff.dto";
import { StoreHalfstuffWriteoffDto } from "./dto/store-halfstuff-writeoff.dto";
import { ProductionQueueActionDto } from "./dto/production-queue-action.dto";

@ApiTags("Furniture Orders")
@Controller("furniture-orders")
export class FurnitureOrdersController {
  constructor(
    private readonly service: FurnitureOrdersService,
    private readonly storeWorkService: OrderStoreWorkService,
  ) {}

  @ApiOperation({ summary: "Создать новую заявку на мебель" })
  @Post()
  create(@Body() dto: CreateFurnitureOrderDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Получить все заявки предприятия" })
  @Get()
  findAll(
    @Query("enterpriseId") enterpriseId?: number,
    @Query("stage") stage?: OrderStageType,
    @Query("clientId") clientId?: number,
    @Query("dateStart") dateStart?: string,
    @Query("dateEnd") dateEnd?: string,
    @Query("excludeCompleted") excludeCompleted?: string,
  ) {
    const ds =
      dateStart != null && dateStart !== "" ? Number(dateStart) : undefined;
    const de = dateEnd != null && dateEnd !== "" ? Number(dateEnd) : undefined;
    const exclude =
      excludeCompleted === "true" || excludeCompleted === "1";
    return this.service.findAll(
      enterpriseId,
      stage,
      clientId,
      ds,
      de,
      exclude,
    );
  }

  @ApiOperation({ summary: "Получить заявки по цеху (для интерфейса цеха)" })
  @Get("by-dept")
  findByDept(
    @Query("enterpriseId") enterpriseId: number,
    @Query("deptId") deptId: number,
  ) {
    return this.service.findByDept(enterpriseId, deptId);
  }

  @ApiOperation({ summary: "Отчёт по зарплате за период" })
  @Get("salary-report")
  getSalaryReport(
    @Query("enterpriseId") enterpriseId: number,
    @Query("dateFrom") dateFrom: number,
    @Query("dateTo") dateTo: number,
  ) {
    return this.service.getSalaryReport(enterpriseId, dateFrom, dateTo);
  }

  @ApiOperation({ summary: "Анализ загруженности цехов (Gantt)" })
  @Get("dept-load-analysis")
  getDeptLoadAnalysis(
    @Query("enterpriseId") enterpriseId: number,
    @Query("currentOrderId") currentOrderId: number,
  ) {
    return this.service.getDeptLoadAnalysis(
      Number(enterpriseId),
      Number(currentOrderId),
    );
  }

  @ApiOperation({ summary: "Омбор ишлари: сводка по складским документам заказа" })
  @Get(":id/store-work")
  getStoreWork(
    @Param("id", ParseIntPipe) id: number,
    @Query("date") date?: string,
    @Query("lite") lite?: string,
  ) {
    const isLite =
      lite === "1" || lite === "true" || lite === "yes";
    if (isLite) {
      return this.storeWorkService.getStoreWorkSummary(id);
    }
    const stockAsOfDateMs =
      date != null && Number.isFinite(Number(date)) && Number(date) > 0
        ? Number(date)
        : undefined;
    return this.storeWorkService.getStoreWork(id, stockAsOfDateMs);
  }

  @ApiOperation({
    summary: "Омбор ишлари: остатки и цены для списания материалов/полуфабрикатов заказа",
  })
  @Get(":id/store-work/writeoff-stocks")
  getWriteoffStocks(
    @Param("id", ParseIntPipe) id: number,
    @Query("date") date?: string,
  ) {
    const stockAsOfDateMs =
      date != null && Number.isFinite(Number(date)) && Number(date) > 0
        ? Number(date)
        : undefined;
    return this.storeWorkService.getWriteoffStocks(id, stockAsOfDateMs);
  }

  @ApiOperation({ summary: "Создать/обновить приход ГП/ПФ по заказу" })
  @Post(":id/store-work/receipt")
  createReceipt(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWorkActionDto,
  ) {
    return this.storeWorkService.createReceipt(
      id,
      dto.userId,
      dto.count,
      dto.costTotal,
      dto.date,
    );
  }

  @ApiOperation({ summary: "Провести приход ГП/ПФ" })
  @Post(":id/store-work/receipt/prove")
  proveReceipt(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWriteoffProveDto,
  ) {
    return this.storeWorkService.proveReceipt(id, dto.docId);
  }

  @ApiOperation({ summary: "Создать накладную клиенту (SaleProd)" })
  @Post(":id/store-work/sale")
  createSale(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWorkActionDto,
  ) {
    const docDateMs =
      dto.date != null && Number.isFinite(Number(dto.date)) && Number(dto.date) > 0
        ? Number(dto.date)
        : undefined;
    return this.storeWorkService.createSale(
      id,
      dto.userId,
      dto.count,
      dto.saleTotal,
      docDateMs,
    );
  }

  @ApiOperation({ summary: "Провести накладную клиенту" })
  @Post(":id/store-work/sale/prove")
  proveSale(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWriteoffProveDto,
  ) {
    return this.storeWorkService.proveSale(id, dto.docId);
  }

  @ApiOperation({ summary: "Создать/обновить списание материалов по заказу" })
  @Post(":id/store-work/material-writeoff")
  createMaterialWriteoff(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreMaterialWriteoffDto,
  ) {
    return this.storeWorkService.createMaterialWriteoff(
      id,
      dto.userId,
      dto.lines,
      dto.date,
    );
  }

  @ApiOperation({ summary: "Провести списание материалов по заказу" })
  @Post(":id/store-work/material-writeoff/prove")
  proveMaterialWriteoff(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWriteoffProveDto,
  ) {
    return this.storeWorkService.proveMaterialWriteoff(id, dto.docId);
  }

  @ApiOperation({
    summary: "Создать/обновить списание полуфабрикатов по заказу",
  })
  @Post(":id/store-work/halfstuff-writeoff")
  createHalfstuffWriteoff(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreHalfstuffWriteoffDto,
  ) {
    return this.storeWorkService.createHalfstuffWriteoff(
      id,
      dto.userId,
      dto.lines,
      dto.date,
    );
  }

  @ApiOperation({ summary: "Провести списание полуфабрикатов по заказу" })
  @Post(":id/store-work/halfstuff-writeoff/prove")
  proveHalfstuffWriteoff(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: StoreWriteoffProveDto,
  ) {
    return this.storeWorkService.proveHalfstuffWriteoff(id, dto.docId);
  }

  @ApiOperation({ summary: "Получить заявку по ID" })
  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: "Удалить заявку и все подчинённые данные" })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @ApiOperation({ summary: "Обновить данные заявки" })
  @Patch(":id")
  update(@Param("id") id: number, @Body() dto: UpdateFurnitureOrderDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: "Обновить техкарту цехов заявки" })
  @Patch(":id/production-queue")
  updateProductionQueue(
    @Param("id") id: number,
    @Body() dto: UpdateProductionQueueDto,
  ) {
    return this.service.updateProductionQueue(id, dto);
  }

  @ApiOperation({
    summary: "Ручное действие с очередью цехов (активация, завершение, сброс)",
  })
  @Post(":id/production-queue/action")
  productionQueueAction(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ProductionQueueActionDto,
  ) {
    return this.service.productionQueueAction(id, dto);
  }

  @ApiOperation({ summary: "Перейти к следующему этапу pipeline" })
  @Post(":id/advance")
  advanceStage(@Param("id") id: number, @Body() dto: AdvanceStageDto) {
    return this.service.advanceStage(id, dto.userId, dto.comment);
  }

  @ApiOperation({ summary: "Вернуться на предыдущий этап pipeline" })
  @Post(":id/revert")
  revertStage(@Param("id") id: number, @Body() dto: RevertStageDto) {
    return this.service.revertStage(id, dto.userId, dto.comment);
  }

  @ApiOperation({
    summary:
      "Импортировать работы, материалы и техкарту из карточки готовой продукции",
  })
  @Post(":id/import-from-card")
  importFromCard(@Param("id") id: number) {
    return this.service.importFromCard(id);
  }
}
