import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { OrderWorkLogsService } from "./orderWorkLogs.service";
import { CreateWorkLeaveMaterialDocDto } from "./dto/create-work-leave-material-doc.dto";

@ApiTags("Order Work Writeoff")
@Controller("order-works")
@UseGuards(JwtAuthGuard)
export class OrderWorkWriteoffController {
  constructor(private readonly service: OrderWorkLogsService) {}

  @ApiOperation({
    summary:
      "Журнал списания материалов LeaveMaterial по строке работы (orderWork)",
  })
  @Get(":workId/leave-material-documents")
  getWorkLeaveMaterialDocuments(@Param("workId") workId: number) {
    return this.service.getLeaveMaterialJournalByWork(Number(workId));
  }

  @ApiOperation({
    summary: "Создать упрощенный LeaveMaterial по строке работы (orderWork)",
  })
  @Post(":workId/leave-material")
  createWorkLeaveMaterial(
    @Param("workId") workId: number,
    @Body() dto: CreateWorkLeaveMaterialDocDto,
  ) {
    return this.service.createLeaveMaterialDocForWork(Number(workId), dto);
  }

  @ApiOperation({
    summary: "Провести LeaveMaterial по строке работы (orderWork)",
  })
  @Post(":workId/leave-material/prove")
  proveWorkLeaveMaterial(@Param("workId") workId: number) {
    return this.service.proveLeaveMaterialDocForWork(Number(workId));
  }
}
