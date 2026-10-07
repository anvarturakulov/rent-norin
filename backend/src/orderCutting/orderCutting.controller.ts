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
import { OrderCuttingService } from "./orderCutting.service";
import { CreateOrderCuttingLineDto } from "./dto/create-order-cutting-line.dto";

@ApiTags("Order Cutting")
@Controller("order-cutting")
export class OrderCuttingController {
  constructor(private readonly service: OrderCuttingService) {}

  @ApiOperation({ summary: "Расход материалов на раскрой по заявке" })
  @Get("issues")
  findIssues(@Query("orderId") orderId: number) {
    return this.service.findIssuesByOrder(Number(orderId));
  }

  @ApiOperation({ summary: "Приход материалов после раскроя по заявке" })
  @Get("outputs")
  findOutputs(@Query("orderId") orderId: number) {
    return this.service.findOutputsByOrder(Number(orderId));
  }

  @ApiOperation({ summary: "Добавить строку расхода" })
  @Post("issues")
  createIssue(@Body() dto: CreateOrderCuttingLineDto) {
    return this.service.createIssue(dto);
  }

  @ApiOperation({ summary: "Добавить строку прихода" })
  @Post("outputs")
  createOutput(@Body() dto: CreateOrderCuttingLineDto) {
    return this.service.createOutput(dto);
  }

  @ApiOperation({ summary: "Обновить строку расхода" })
  @Patch("issues/:id")
  updateIssue(
    @Param("id") id: number,
    @Body() dto: Partial<CreateOrderCuttingLineDto>,
  ) {
    return this.service.updateIssue(Number(id), dto);
  }

  @ApiOperation({ summary: "Обновить строку прихода" })
  @Patch("outputs/:id")
  updateOutput(
    @Param("id") id: number,
    @Body() dto: Partial<CreateOrderCuttingLineDto>,
  ) {
    return this.service.updateOutput(Number(id), dto);
  }

  @ApiOperation({ summary: "Удалить строку расхода" })
  @Delete("issues/:id")
  removeIssue(@Param("id") id: number) {
    return this.service.removeIssue(Number(id));
  }

  @ApiOperation({ summary: "Удалить строку прихода" })
  @Delete("outputs/:id")
  removeOutput(@Param("id") id: number) {
    return this.service.removeOutput(Number(id));
  }

  @ApiOperation({ summary: "Остатки листовых материалов по размерам" })
  @Get("balances")
  getBalances(
    @Query("enterpriseId") enterpriseId: number,
    @Query("materialId") materialId?: number,
    @Query("hideZero") hideZero?: string,
  ) {
    return this.service.getBalances({
      enterpriseId: Number(enterpriseId),
      materialId: materialId ? Number(materialId) : undefined,
      hideZero: hideZero !== "false",
    });
  }
}
