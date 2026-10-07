import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OrderCommonWorksService } from "./orderCommonWorks.service";
import { CreateOrderCommonWorkDto } from "./dto/create-order-common-work.dto";

@ApiTags("Order Common Works")
@Controller("order-common-works")
export class OrderCommonWorksController {
  constructor(private readonly service: OrderCommonWorksService) {}

  @ApiOperation({ summary: "Добавить общую работу к заявке" })
  @Post()
  create(@Body() dto: CreateOrderCommonWorkDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Получить общие работы заявки" })
  @Get()
  findByOrder(@Query("orderId") orderId: number) {
    return this.service.findByOrder(Number(orderId));
  }

  @ApiOperation({ summary: "Заменить все общие работы заявки" })
  @Put("order/:orderId")
  replaceForOrder(
    @Param("orderId") orderId: number,
    @Body() rows: CreateOrderCommonWorkDto[],
  ) {
    return this.service.replaceForOrder(Number(orderId), rows ?? []);
  }

  @ApiOperation({ summary: "Обновить общую работу" })
  @Patch(":id")
  update(
    @Param("id") id: number,
    @Body() dto: Partial<CreateOrderCommonWorkDto>,
  ) {
    return this.service.update(Number(id), dto);
  }

  @ApiOperation({ summary: "Удалить общую работу из заявки" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.service.remove(Number(id));
  }
}
