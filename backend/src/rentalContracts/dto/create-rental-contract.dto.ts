import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { RentalContractStatus } from "src/interfaces/rental-contract.interface";

export class CreateRentalContractDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  enterpriseId?: number;

  @ApiProperty({
    required: false,
    description:
      "При создании не обязателен — номер задаётся сервером (001-YYYY).",
  })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  clientId: number;

  @ApiProperty({ description: "Дата договора (мс)" })
  @Type(() => Number)
  @IsNumber()
  contractDate: number;

  @ApiProperty({ required: false, description: "Дата окончания (мс)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  endDate?: number | null;

  @ApiProperty({ enum: RentalContractStatus, required: false })
  @IsOptional()
  @IsEnum(RentalContractStatus)
  status?: RentalContractStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string | null;
}
