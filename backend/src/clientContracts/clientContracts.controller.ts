import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ClientContractsService } from "./clientContracts.service";
import { CreateClientContractDto } from "./dto/create-client-contract.dto";
import { UpdateClientContractDto } from "./dto/update-client-contract.dto";
import {
  AttachSaleToContractLineDto,
  CreateSaleFromContractDto,
} from "./dto/create-sale-from-contract.dto";

@ApiTags("Client contracts")
@Controller("client-contracts")
export class ClientContractsController {
  constructor(private readonly service: ClientContractsService) {}

  @ApiOperation({ summary: "Список договоров" })
  @Get()
  findAll(
    @Query("enterpriseId") enterpriseId?: string,
    @Query("dateStart") dateStart?: string,
    @Query("dateEnd") dateEnd?: string,
  ) {
    const ent =
      enterpriseId != null &&
      enterpriseId !== "" &&
      Number.isFinite(Number(enterpriseId))
        ? Number(enterpriseId)
        : undefined;
    const ds =
      dateStart != null && dateStart !== "" ? Number(dateStart) : undefined;
    const de = dateEnd != null && dateEnd !== "" ? Number(dateEnd) : undefined;
    return this.service.findAll(ent, ds, de);
  }

  @ApiOperation({
    summary: "Следующий номер договора по году (предпросмотр до сохранения)",
  })
  @Get("next-number")
  nextNumber(
    @Query("enterpriseId") enterpriseId?: string,
    @Query("year") year?: string,
  ) {
    const entRaw =
      enterpriseId != null && enterpriseId !== ""
        ? Number(enterpriseId)
        : null;
    const ent =
      entRaw != null && Number.isFinite(entRaw) ? entRaw : null;
    const y =
      year != null && year !== "" && Number.isFinite(Number(year))
        ? Number(year)
        : new Date().getFullYear();
    return this.service
      .previewNextNumber(ent, y)
      .then((contractNumber) => ({ contractNumber }));
  }

  @ApiOperation({ summary: "Кандидаты документов реализации для строки" })
  @Get(":id/sale-candidates")
  saleCandidates(
    @Param("id") id: string,
    @Query("lineType") lineType: "item" | "order" = "item",
    @Query("lineId") lineId?: string,
  ) {
    return this.service.findSaleCandidates(
      Number(id),
      lineType === "order" ? "order" : "item",
      Number(lineId),
    );
  }

  @ApiOperation({ summary: "Договор по ID" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(Number(id));
  }

  @ApiOperation({ summary: "Создать договор" })
  @Post()
  create(@Body() dto: CreateClientContractDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Обновить договор" })
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClientContractDto) {
    return this.service.update(Number(id), dto);
  }

  @ApiOperation({ summary: "Привязать/отвязать документ реализации" })
  @Post(":id/attach-sale")
  attachSale(
    @Param("id") id: string,
    @Body() dto: AttachSaleToContractLineDto,
  ) {
    return this.service.attachSale(Number(id), dto);
  }

  @ApiOperation({ summary: "Создать документы продажи по строкам ТМЦ/услуг" })
  @Post(":id/create-sale")
  createSale(
    @Param("id") id: string,
    @Body() dto: CreateSaleFromContractDto,
  ) {
    return this.service.createSaleDocuments(
      Number(id),
      dto.userId,
      dto.itemLineIds,
    );
  }

  @ApiOperation({ summary: "Удалить договор" })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.service.remove(Number(id));
  }
}
