import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrderWorksService } from "./orderWorks.service";
import { CreateOrderWorkDto } from "./dto/create-order-work.dto";
import { UpdateOrderWorkDto } from "./dto/update-order-work.dto";
import { SetLineOrderDto } from "./dto/set-line-order.dto";

@ApiTags("Order Works")
@Controller("order-works")
export class OrderWorksController {
  constructor(private readonly service: OrderWorksService) {}

  @ApiOperation({ summary: "Создать работу для заявки" })
  @Post()
  create(@Body() dto: CreateOrderWorkDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Получить работы по заявке" })
  @Get()
  findByOrder(@Query("orderId") orderId: number) {
    return this.service.findByOrder(orderId);
  }

  @ApiOperation({ summary: "Получить активные работы цеха" })
  @Get("by-dept")
  findByDept(@Query("deptId") deptId: number) {
    return this.service.findByDeptAndQueue(deptId, "ACTIVE");
  }

  @ApiOperation({
    summary:
      "Доска производства: заказы IN_PRODUCTION с незавершёнными работами",
  })
  @Get("production-board")
  getProductionBoard(@Query("enterpriseId") enterpriseId: number) {
    return this.service.getProductionBoard(Number(enterpriseId));
  }

  @ApiOperation({
    summary:
      "Задать порядок строк работ заявки (полный список id в нужном порядке)",
  })
  @Put("order/:orderId/line-order")
  setLineOrder(
    @Param("orderId", ParseIntPipe) orderId: number,
    @Body() dto: SetLineOrderDto,
  ) {
    return this.service.setLineOrder(orderId, dto.workIds);
  }

  @ApiOperation({ summary: "Получить работу по ID" })
  @Get(":id")
  findOne(@Param("id") id: number) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: "Обновить работу" })
  @Patch(":id")
  update(@Param("id") id: number, @Body() dto: UpdateOrderWorkDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: "Удалить работу" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.service.remove(id);
  }
}
