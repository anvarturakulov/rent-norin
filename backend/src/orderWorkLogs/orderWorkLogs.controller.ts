import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrderWorkLogsService } from "./orderWorkLogs.service";
import { CreateOrderWorkLogDto } from "./dto/create-order-work-log.dto";
import { FinishOrderWorkLogDto } from "./dto/finish-order-work-log.dto";
import { CreateLeaveMaterialDocDto } from "./dto/create-leave-material-doc.dto";
import { CreateWorkLeaveMaterialDocDto } from "./dto/create-work-leave-material-doc.dto";
import { CurrentUser } from "src/common/decorators/current-enterprise.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@ApiTags("Order Work Logs")
@Controller("order-work-logs")
@UseGuards(JwtAuthGuard)
export class OrderWorkLogsController {
  constructor(private readonly service: OrderWorkLogsService) {}

  @ApiOperation({ summary: "Сотрудник текущего пользователя (справочник WORKERS)" })
  @Get("my-worker")
  getMyWorker(@CurrentUser() user: any) {
    return this.service.getMyWorker(Number(user?.id));
  }

  @ApiOperation({ summary: "Отчёт по трудозатратам за период" })
  @Get("time-report")
  getTimeReport(
    @Query("enterpriseId") enterpriseId: number,
    @Query("dateFrom") dateFrom: number,
    @Query("dateTo") dateTo: number,
  ) {
    return this.service.getTimeReport(
      Number(enterpriseId),
      Number(dateFrom),
      Number(dateTo),
    );
  }

  @ApiOperation({ summary: "Начать выполнение работы" })
  @Post("start")
  startWork(@Body() dto: CreateOrderWorkLogDto, @CurrentUser() user: any) {
    return this.service.startWork(dto, Number(user?.id));
  }

  @ApiOperation({ summary: "Поставить работу на паузу" })
  @Post(":id/pause")
  pauseWork(@Param("id") id: number, @CurrentUser() user: any) {
    return this.service.pauseWork(Number(id), Number(user?.id));
  }

  @ApiOperation({ summary: "Завершить работу (вносит кол-во и материалы)" })
  @Post(":id/finish")
  finishWork(
    @Param("id") id: number,
    @Body() dto: FinishOrderWorkLogDto,
    @CurrentUser() user: any,
  ) {
    return this.service.finishWork(
      Number(id),
      dto.userId,
      dto,
      Number(user?.id),
    );
  }

  @ApiOperation({
    summary: "Создать документ списания LeaveMaterial по завершенному work log",
  })
  @Post(":id/create-leave-material-doc")
  createLeaveMaterialDoc(
    @Param("id") id: number,
    @Body() dto: CreateLeaveMaterialDocDto,
  ) {
    return this.service.createLeaveMaterialDoc(id, dto);
  }

  @ApiOperation({
    summary: "Журнал списания материалов по строке работы (orderWork)",
  })
  @Get("work/:workId/leave-material-doc")
  getWorkLeaveMaterialDoc(@Param("workId") workId: number) {
    return this.service.getLeaveMaterialJournalByWork(Number(workId));
  }

  @ApiOperation({
    summary: "Создать LeaveMaterial для строки работы (упрощенно)",
  })
  @Post("work/:workId/leave-material-doc")
  createWorkLeaveMaterialDoc(
    @Param("workId") workId: number,
    @Body() dto: CreateWorkLeaveMaterialDocDto,
  ) {
    return this.service.createLeaveMaterialDocForWork(Number(workId), dto);
  }

  @ApiOperation({ summary: "Провести LeaveMaterial для строки работы" })
  @Post("work/:workId/leave-material-doc/prove")
  proveWorkLeaveMaterialDoc(@Param("workId") workId: number) {
    return this.service.proveLeaveMaterialDocForWork(Number(workId));
  }

  @ApiOperation({ summary: "Получить логи по работе" })
  @Get("by-work")
  findByWork(@Query("workId") workId: number) {
    return this.service.findByWork(workId);
  }

  @ApiOperation({ summary: "Получить все логи по заявке" })
  @Get("by-order")
  findByOrder(@Query("orderId") orderId: number) {
    return this.service.findByOrder(orderId);
  }

  @ApiOperation({ summary: "Получить данные для расчёта ЗП за период" })
  @Get("salary-period")
  getSalaryByPeriod(
    @Query("enterpriseId") enterpriseId: number,
    @Query("dateFrom") dateFrom: number,
    @Query("dateTo") dateTo: number,
  ) {
    return this.service.getSalaryByPeriod(enterpriseId, dateFrom, dateTo);
  }
}
