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
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RentalContractsService } from "./rentalContracts.service";
import { CreateRentalContractDto } from "./dto/create-rental-contract.dto";
import { UpdateRentalContractDto } from "./dto/update-rental-contract.dto";
import { CreateManyRentalContractsDto } from "./dto/createManyRentalContracts.dto";

@ApiTags("Rental contracts")
@Controller("rental-contracts")
@UseGuards(JwtAuthGuard)
export class RentalContractsController {
  constructor(private readonly service: RentalContractsService) {}

  @ApiOperation({ summary: "Список договоров аренды" })
  @Get()
  findAll(
    @Query("enterpriseId") enterpriseId?: string,
    @Query("clientId") clientId?: string,
    @Query("dateStart") dateStart?: string,
    @Query("dateEnd") dateEnd?: string,
  ) {
    const ent =
      enterpriseId != null && enterpriseId !== "" && Number.isFinite(Number(enterpriseId))
        ? Number(enterpriseId)
        : undefined;
    const client =
      clientId != null && clientId !== "" && Number.isFinite(Number(clientId))
        ? Number(clientId)
        : undefined;
    const ds =
      dateStart != null && dateStart !== "" ? Number(dateStart) : undefined;
    const de = dateEnd != null && dateEnd !== "" ? Number(dateEnd) : undefined;
    return this.service.findAll(ent, client, ds, de);
  }

  @ApiOperation({ summary: "Следующий номер договора по году" })
  @Get("next-number")
  nextNumber(
    @Query("enterpriseId") enterpriseId?: string,
    @Query("year") year?: string,
  ) {
    const entRaw =
      enterpriseId != null && enterpriseId !== "" ? Number(enterpriseId) : null;
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

  @ApiOperation({ summary: "Активный договор аренды клиента на дату" })
  @Get("by-client/:clientId/active")
  findActiveByClient(
    @Param("clientId") clientId: string,
    @Query("asOf") asOf?: string,
  ) {
    const asOfMs =
      asOf != null && asOf !== "" && Number.isFinite(Number(asOf))
        ? Number(asOf)
        : undefined;
    return this.service.findActiveByClient(Number(clientId), asOfMs);
  }

  @ApiOperation({ summary: "Договоры аренды клиента" })
  @Get("by-client/:clientId")
  findByClient(@Param("clientId") clientId: string) {
    return this.service.findByClient(Number(clientId));
  }

  @ApiOperation({ summary: "Массовое создание договоров аренды" })
  @Post("create-bulk")
  createBulk(@Body() body: CreateManyRentalContractsDto) {
    return this.service.createMany(body.items ?? []);
  }

  @ApiOperation({
    summary: "Удалить все договоры аренды (по enterpriseId или все)",
  })
  @Delete("all")
  removeAll(@Query("enterpriseId") enterpriseId?: string) {
    const ent =
      enterpriseId != null &&
      enterpriseId !== "" &&
      Number.isFinite(Number(enterpriseId))
        ? Number(enterpriseId)
        : undefined;
    return this.service.removeAll(ent);
  }

  @ApiOperation({ summary: "Договор аренды по ID" })
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(Number(id));
  }

  @ApiOperation({ summary: "Создать договор аренды" })
  @Post()
  create(@Body() dto: CreateRentalContractDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: "Обновить договор аренды" })
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRentalContractDto) {
    return this.service.update(Number(id), dto);
  }

  @ApiOperation({ summary: "Удалить договор аренды" })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.service.remove(Number(id));
  }
}
