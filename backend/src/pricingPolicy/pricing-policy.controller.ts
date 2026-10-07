import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { PricingPolicyService } from "./pricing-policy.service";
import { CreateMarkupDefinitionDto } from "./dto/create-markup-definition.dto";
import { UpdateMarkupDefinitionDto } from "./dto/update-markup-definition.dto";
import { CreatePricingSnapshotDto } from "./dto/create-pricing-snapshot.dto";
import { UpdatePricingSnapshotDto } from "./dto/update-pricing-snapshot.dto";
import { PRICING_POLICY_WRITE_ROLES } from "./pricing-policy.constants";

@ApiTags("Ценовая политика")
@Controller("pricing-policy")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingPolicyController {
  constructor(private readonly service: PricingPolicyService) {}

  @ApiOperation({ summary: "Каталог строк наценок" })
  @Roles("ALL")
  @Get("definitions")
  getDefinitions(@Query("enterpriseId") enterpriseId?: string) {
    const parsed =
      enterpriseId !== undefined && enterpriseId !== ""
        ? Number(enterpriseId)
        : undefined;
    return this.service.getDefinitions(
      parsed !== undefined && !Number.isNaN(parsed) ? parsed : null,
    );
  }

  @ApiOperation({ summary: "Добавить наценку до себестоимости" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Post("definitions")
  createDefinition(@Body() dto: CreateMarkupDefinitionDto) {
    return this.service.createDefinition(dto);
  }

  @ApiOperation({ summary: "Обновить строку наценки (имя / порядок)" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Patch("definitions/:id")
  updateDefinition(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMarkupDefinitionDto,
  ) {
    return this.service.updateDefinition(id, dto);
  }

  @ApiOperation({ summary: "Удалить наценку до себестоимости (soft)" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Delete("definitions/:id")
  deleteDefinition(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteDefinition(id);
  }

  @ApiOperation({ summary: "Список снимков ценовой политики" })
  @Roles("ALL")
  @Get("snapshots")
  listSnapshots(@Query("enterpriseId") enterpriseId?: string) {
    const parsed =
      enterpriseId !== undefined && enterpriseId !== ""
        ? Number(enterpriseId)
        : undefined;
    return this.service.listSnapshots(
      parsed !== undefined && !Number.isNaN(parsed) ? parsed : null,
    );
  }

  @ApiOperation({ summary: "Снимок с матрицей значений" })
  @Roles("ALL")
  @Get("snapshots/:id")
  getSnapshot(@Param("id", ParseIntPipe) id: number) {
    return this.service.getSnapshotById(id);
  }

  @ApiOperation({ summary: "Создать снимок ценовой политики на дату" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Post("snapshots")
  createSnapshot(@Body() dto: CreatePricingSnapshotDto) {
    return this.service.createSnapshot(dto);
  }

  @ApiOperation({ summary: "Обновить снимок" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Patch("snapshots/:id")
  updateSnapshot(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePricingSnapshotDto,
  ) {
    return this.service.updateSnapshot(id, dto);
  }

  @ApiOperation({ summary: "Удалить снимок" })
  @Roles(...PRICING_POLICY_WRITE_ROLES)
  @Delete("snapshots/:id")
  deleteSnapshot(@Param("id", ParseIntPipe) id: number) {
    return this.service.deleteSnapshot(id);
  }

  @ApiOperation({ summary: "Политика, действующая на дату" })
  @ApiQuery({ name: "date", required: true, type: Number })
  @ApiQuery({ name: "enterpriseId", required: false, type: Number })
  @Roles("ALL")
  @Get("for-date")
  getForDate(
    @Query("date") date: string,
    @Query("enterpriseId") enterpriseId?: string,
  ) {
    const parsedDate = Number(date);
    if (!parsedDate || Number.isNaN(parsedDate)) {
      return this.service.getPolicyForDate(Date.now(), null);
    }
    const parsedEnt =
      enterpriseId !== undefined && enterpriseId !== ""
        ? Number(enterpriseId)
        : undefined;
    return this.service.getPolicyForDate(
      parsedDate,
      parsedEnt !== undefined && !Number.isNaN(parsedEnt) ? parsedEnt : null,
    );
  }
}
