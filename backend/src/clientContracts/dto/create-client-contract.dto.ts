import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ClientContractStatus } from "src/interfaces/client-contract.interface";
import { ClientContractOrderLineDto } from "./client-contract-order-line.dto";
import { ClientContractExpenseLineDto } from "./client-contract-expense-line.dto";
import { ClientContractItemLineDto } from "./client-contract-item-line.dto";

export class CreateClientContractDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  enterpriseId?: number;

  @ApiProperty({
    required: false,
    description:
      "При создании не обязателен — номер задаётся сервером (001-YYYY). При обновлении можно передать явно.",
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

  @ApiProperty({ enum: ClientContractStatus, required: false })
  @IsOptional()
  @IsEnum(ClientContractStatus)
  status?: ClientContractStatus;

  @ApiProperty({ type: [ClientContractOrderLineDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientContractOrderLineDto)
  orderLines?: ClientContractOrderLineDto[];

  @ApiProperty({ type: [ClientContractItemLineDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientContractItemLineDto)
  itemLines?: ClientContractItemLineDto[];

  @ApiProperty({ type: [ClientContractExpenseLineDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientContractExpenseLineDto)
  expenseLines?: ClientContractExpenseLineDto[];
}
