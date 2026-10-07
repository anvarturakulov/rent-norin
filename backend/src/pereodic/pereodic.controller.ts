import {
  Controller,
  Delete,
  Get,
  HttpException,
  NotFoundException,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Param, Post } from "@nestjs/common";
import { Body, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Roles } from "src/auth/roles-auth.decorator";
import { RolesGuard } from "src/auth/roles.guard";
import { Request } from "express";
import { PereodicService } from "./pereodic.service";
import { Pereodic } from "./pereodic.model";
import { PEREODIC_NOT_FOUND_ERROR } from "./pereodic.constants";
import { UpdateCreatePereodicDto } from "./dto/updateCreatePereodic.dto";
import { CurrentEnterprise } from "src/common/decorators/current-enterprise.decorator";

@Controller("pereodic")
export class PereodicController {
  constructor(private pereodicService: PereodicService) {}

  @ApiOperation({
    summary:
      "Получение переодических значений для справочника по id и типу значения",
  })
  @ApiResponse({ status: 200, type: [Pereodic] })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("value")
  getAllPereodics(
    @Req() request: Request,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    const referenceId = request.query?.referenceId
      ? +request.query?.referenceId
      : 0;
    const valueName = request.query?.valueName
      ? (request.query?.valueName as string)
      : "";

    const pereodics = this.pereodicService.getAllPereodicsByValueName(
      referenceId,
      valueName,
      enterpriseId,
    );

    return pereodics;
  }

  @ApiOperation({
    summary:
      "Получение переодических значений для справочника по id и типу значения",
  })
  @ApiResponse({ status: 200, type: Number })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("valueForDate")
  getValuePerodicForDate(
    @Req() request: Request,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    const referenceId = request.query?.referenceId
      ? +request.query?.referenceId
      : 0;
    const valueName = request.query?.valueName
      ? (request.query?.valueName as string)
      : "";
    const date = request.query?.date ? +request.query?.date : 0;

    const value = this.pereodicService.getPeredicValueForDate(
      referenceId,
      valueName,
      date,
      enterpriseId,
    );

    return value;
  }

  @ApiOperation({ summary: "Пометить на удаление документа" })
  @ApiResponse({ status: 200, type: Pereodic })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Delete("markToDelete/:id")
  async markToDelete(@Param("id") id: number) {
    const deletedPereodic = await this.pereodicService.deletePereodicById(id);
    if (!deletedPereodic) {
      throw new HttpException(PEREODIC_NOT_FOUND_ERROR, HttpStatus.NOT_FOUND);
    }
    return deletedPereodic;
  }

  @ApiOperation({ summary: "Получение документа по id" })
  @ApiResponse({ status: 200, type: Pereodic })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Get("/:id")
  getById(@Param("id") id: number) {
    return this.pereodicService.getPereodicById(id);
  }

  @ApiOperation({ summary: "Обновить переодическое значение" })
  @ApiResponse({ status: 200, type: Pereodic })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Patch("update/:id")
  async updatePereodic(
    @Param("id") id: number,
    @Body() dto: UpdateCreatePereodicDto,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    // Проверяем, что пользователь может редактировать только свои записи
    const existingPereodic = await this.pereodicService.getPereodicById(id);
    if (
      existingPereodic &&
      existingPereodic.enterpriseId !== enterpriseId &&
      existingPereodic.enterpriseId !== null
    ) {
      throw new HttpException("Access denied", HttpStatus.FORBIDDEN);
    }

    // Устанавливаем enterpriseId если не указан
    if (dto.enterpriseId === undefined) {
      dto.enterpriseId = enterpriseId;
    }

    const updatedPereodic = await this.pereodicService.updatePereodicById(
      id,
      dto,
    );

    if (!updatedPereodic) {
      throw new NotFoundException(PEREODIC_NOT_FOUND_ERROR);
    }

    return updatedPereodic;
  }

  @ApiOperation({ summary: "Открыть новое переодическое значение" })
  @ApiResponse({ status: 200, type: Pereodic })
  @Roles("ALL")
  @UseGuards(RolesGuard)
  @Post("/create")
  async createPereodic(
    @Body() dto: UpdateCreatePereodicDto,
    @CurrentEnterprise() enterpriseId: number | null,
  ) {
    // Автоматически устанавливаем enterpriseId из текущего пользователя
    dto.enterpriseId = enterpriseId;
    const newPereodic = await this.pereodicService.createPereodic(dto);
    return newPereodic;
  }
}
