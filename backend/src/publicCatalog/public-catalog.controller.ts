import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PublicCatalogService } from "./public-catalog.service";

@ApiTags("Public catalog")
@Controller("public/catalog")
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get("tree")
  @ApiOperation({
    summary: "Публичный каталог ТМЗ (без JWT)",
    description:
      "Возвращает папки на пути к опубликованным товарам и сами товары с showOnWebsite. Фильтр по enterpriseId из env PUBLIC_CATALOG_ENTERPRISE_ID.",
  })
  getTree() {
    return this.publicCatalogService.getTree();
  }

  @Get("tools/tree")
  @ApiOperation({
    summary: "Публичный каталог инструментов (без JWT)",
    description:
      "Возвращает папки на пути к опубликованным инструментам (TypeTMZ.TOOLS) с showOnWebsite. Фильтр по enterpriseId из env PUBLIC_TOOLS_CATALOG_ENTERPRISE_ID.",
  })
  getToolsTree() {
    return this.publicCatalogService.getToolsTree();
  }
}
