import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductCalculationsService } from "./productCalculations.service";
import { CreateProductCalculationDto } from "./dto/create-product-calculation.dto";
import { UpdateProductCalculationDto } from "./dto/update-product-calculation.dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import {
  CurrentUser,
  CurrentEnterprise,
} from "src/common/decorators/current-enterprise.decorator";

@ApiTags("Product Calculations")
@Controller("product-calculations")
export class ProductCalculationsController {
  constructor(
    private readonly productCalculationsService: ProductCalculationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Создать калькуляцию продукта" })
  @ApiResponse({ status: 201, description: "Калькуляция успешно создана" })
  @ApiResponse({ status: 400, description: "Неверные данные" })
  @ApiResponse({ status: 404, description: "Продукт или материал не найден" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  create(
    @Body() createProductCalculationDto: CreateProductCalculationDto,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    // Автоматически устанавливаем enterpriseId из пользователя, если не указан
    if (!createProductCalculationDto.enterpriseId && enterpriseId) {
      createProductCalculationDto.enterpriseId = enterpriseId;
    }
    return this.productCalculationsService.create(
      createProductCalculationDto,
      user?.enterpriseId,
      user?.isSuperUser,
    );
  }

  @Get()
  @ApiOperation({ summary: "Получить все калькуляции" })
  @ApiResponse({ status: 200, description: "Список всех калькуляций" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  findAll(
    @Query("enterpriseId") enterpriseId?: string,
    @CurrentEnterprise() currentEnterpriseId: number | null = null,
    @CurrentUser() user?: any,
  ) {
    // Если enterpriseId не указан в query, используем enterpriseId пользователя
    const parsedEnterpriseId =
      enterpriseId !== undefined
        ? Number(enterpriseId)
        : (currentEnterpriseId ?? undefined);
    return this.productCalculationsService.findAll(
      parsedEnterpriseId,
      user?.isSuperUser,
    );
  }

  @Get("product/:productId")
  @ApiOperation({ summary: "Получить калькуляции для конкретного продукта" })
  @ApiResponse({ status: 200, description: "Калькуляции продукта" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  findByProductId(
    @Param("productId") productId: string,
    @Query("enterpriseId") enterpriseId?: string,
    @CurrentEnterprise() currentEnterpriseId: number | null = null,
    @CurrentUser() user?: any,
  ) {
    const parsedEnterpriseId =
      enterpriseId !== undefined
        ? Number(enterpriseId)
        : (currentEnterpriseId ?? undefined);
    return this.productCalculationsService.findByProductId(
      +productId,
      parsedEnterpriseId,
      user?.isSuperUser,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить калькуляцию по ID" })
  @ApiResponse({ status: 200, description: "Калькуляция найдена" })
  @ApiResponse({ status: 404, description: "Калькуляция не найдена" })
  findOne(@Param("id") id: string) {
    return this.productCalculationsService.findOne(+id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить калькуляцию" })
  @ApiResponse({ status: 200, description: "Калькуляция обновлена" })
  @ApiResponse({ status: 404, description: "Калькуляция не найдена" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  update(
    @Param("id") id: string,
    @Body() updateProductCalculationDto: UpdateProductCalculationDto,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    return this.productCalculationsService.update(
      +id,
      updateProductCalculationDto,
      user?.enterpriseId,
      user?.isSuperUser,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить калькуляцию" })
  @ApiResponse({ status: 200, description: "Калькуляция удалена" })
  @ApiResponse({ status: 404, description: "Калькуляция не найдена" })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  remove(
    @Param("id") id: string,
    @CurrentEnterprise() enterpriseId: number | null,
    @CurrentUser() user: any,
  ) {
    return this.productCalculationsService.remove(
      +id,
      user?.enterpriseId,
      user?.isSuperUser,
    );
  }
}
