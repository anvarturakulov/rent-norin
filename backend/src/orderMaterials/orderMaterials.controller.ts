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
import { OrderMaterialsService } from "./orderMaterials.service";
import { CreateOrderMaterialDto } from "./dto/create-order-material.dto";

@ApiTags("Order Materials")
@Controller("order-materials")
export class OrderMaterialsController {
  constructor(private readonly service: OrderMaterialsService) {}

  @ApiOperation({ summary: "Добавить материал к заявке" })
  @Post()
  create(@Body() dto: CreateOrderMaterialDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Получить материалы заявки" })
  @Get()
  findByOrder(@Query("orderId") orderId: number) {
    return this.service.findByOrder(orderId);
  }

  @ApiOperation({ summary: "Обновить материал" })
  @Patch(":id")
  update(
    @Param("id") id: number,
    @Body() dto: Partial<CreateOrderMaterialDto>,
  ) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: "Удалить материал из заявки" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.service.remove(id);
  }
}
