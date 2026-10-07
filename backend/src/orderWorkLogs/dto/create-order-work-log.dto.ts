import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber } from "class-validator";

export class CreateOrderWorkLogDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  workId: number;

  @ApiProperty({ example: 1738368000000 })
  @IsNumber()
  date: number;
}
