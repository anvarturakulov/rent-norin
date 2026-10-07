import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";

export class DocumentActionDto {
  @ApiProperty({
    example: 1,
    description: "Идентификатор предприятия, выполняющего действие",
  })
  @IsInt({ message: "enterpriseId должен быть целым числом" })
  enterpriseId: number;
}

export class RejectDocumentDto extends DocumentActionDto {
  @ApiProperty({
    example: "Несоответствие количества",
    description: "Причина отклонения",
  })
  @IsString({ message: "reason должна быть строкой" })
  reason: string;
}

export class AcceptDocumentDto extends DocumentActionDto {
  @ApiProperty({
    example: false,
    required: false,
    description: "Флаг немедленного проведения (зарезервировано)",
  })
  @IsOptional()
  finaliseImmediately?: boolean;
}
