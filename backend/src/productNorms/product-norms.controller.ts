import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ProductNormsService } from "./product-norms.service";
import { ReplaceProductNormsDto } from "./dto/replace-product-norms.dto";
import { RolesGuard } from "src/auth/roles.guard";
import { Roles } from "src/auth/roles-auth.decorator";

@ApiTags("Нормы готовой продукции (ТМЗ)")
@Controller("product-norms")
export class ProductNormsController {
  constructor(private readonly service: ProductNormsService) {}

  @ApiOperation({ summary: "Нормы по ID справочника (ТМЗ PRODUCT)" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get(":referenceId")
  getBundle(@Param("referenceId", ParseIntPipe) referenceId: number) {
    return this.service.getBundle(referenceId);
  }

  @ApiOperation({ summary: "Эффективные нормы (с учётом BOM)" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get(":referenceId/resolved")
  getResolved(@Param("referenceId", ParseIntPipe) referenceId: number) {
    return this.service.resolveProductNorms(referenceId);
  }

  @ApiOperation({ summary: "Заменить все нормы изделия" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Put(":referenceId")
  replaceAll(
    @Param("referenceId", ParseIntPipe) referenceId: number,
    @Body() dto: ReplaceProductNormsDto,
  ) {
    return this.service.replaceAll(referenceId, dto);
  }

  @ApiOperation({
    summary: "Расчёт ценообразования по эффективным нормам (BOM/без BOM)",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get(":referenceId/pricing")
  getPricing(@Param("referenceId", ParseIntPipe) referenceId: number) {
    return this.service.getPricing(referenceId);
  }

  @ApiOperation({
    summary: "Записать рассчитанную цену в карточку ТМЗ (firstPrice)",
  })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Post(":referenceId/pricing/apply")
  applyPricing(
    @Param("referenceId", ParseIntPipe) referenceId: number,
    @Body() body?: { writeToFirstPrice?: boolean },
  ) {
    return this.service.applyPricingToCard(referenceId, body);
  }
}
