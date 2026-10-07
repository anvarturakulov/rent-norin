import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, Max, Min } from "class-validator";

export class SnapshotValueDto {
  @ApiProperty({ example: "DEALER" })
  @IsString()
  markupCode: string;

  @ApiProperty({ example: 15, description: "Наценка для класса A" })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentClassA: number;

  @ApiProperty({ example: 20, description: "Наценка для класса B" })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentClassB: number;

  @ApiProperty({ example: 25, description: "Наценка для класса C" })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentClassC: number;
}
