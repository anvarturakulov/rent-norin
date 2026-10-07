import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrderHalfstuffsService } from "./orderHalfstuffs.service";
import { CreateOrderHalfstuffDto } from "./dto/create-order-halfstuff.dto";

@ApiTags("Order Halfstuffs")
@Controller("order-halfstuffs")
export class OrderHalfstuffsController {
  constructor(private readonly service: OrderHalfstuffsService) {}

  @ApiOperation({ summary: "Добавить полуфабрикат к заявке" })
  @Post()
  create(@Body() dto: CreateOrderHalfstuffDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Получить полуфабрикаты заявки" })
  @Get()
  findByOrder(@Query("orderId") orderId: number) {
    return this.service.findByOrder(orderId);
  }

  @ApiOperation({ summary: "Обновить полуфабрикат" })
  @Patch(":id")
  update(
    @Param("id") id: number,
    @Body() dto: Partial<CreateOrderHalfstuffDto>,
  ) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: "Удалить полуфабрикат из заявки" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.service.remove(id);
  }
}
