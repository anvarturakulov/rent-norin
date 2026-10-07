import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsString, Min, MinLength } from "class-validator";

export class ClientContractExpenseLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  expenseName: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}
