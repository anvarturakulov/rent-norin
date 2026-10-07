import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { EnterprisesService } from "./enterprises.service";
import { Enterprise } from "./enterprise.model";
import { CreateEnterpriseDto } from "./dto/create-enterprise.dto";
import { UpdateEnterpriseDto } from "./dto/update-enterprise.dto";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { UserRoles } from "src/interfaces/user.interface";

@ApiTags("Предприятия")
@Controller("enterprises")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterprisesController {
  constructor(private readonly enterprisesService: EnterprisesService) {}

  @Get()
  @ApiOperation({ summary: "Получить список всех предприятий" })
  @ApiResponse({ status: 200, type: [Enterprise] })
  @Roles("ALL")
  findAll() {
    return this.enterprisesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить предприятие по идентификатору" })
  @ApiResponse({ status: 200, type: Enterprise })
  findById(@Param("id") id: string) {
    return this.enterprisesService.findById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: "Создать предприятие" })
  @ApiResponse({ status: 201, type: Enterprise })
  @Roles(UserRoles.ADMINGLOBAL)
  create(@Body() dto: CreateEnterpriseDto) {
    return this.enterprisesService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Обновить данные предприятия" })
  @ApiResponse({ status: 200, type: Enterprise })
  @Roles(UserRoles.ADMINGLOBAL)
  update(@Param("id") id: string, @Body() dto: UpdateEnterpriseDto) {
    return this.enterprisesService.update(Number(id), dto);
  }

  @Patch(":id/mark-to-delete")
  @ApiOperation({ summary: "Пометить предприятие на удаление" })
  @ApiResponse({ status: 200, type: Enterprise })
  @Roles(UserRoles.ADMINGLOBAL)
  async markToDelete(@Param("id") id: string) {
    return this.enterprisesService.markToDelete(Number(id));
  }
}
