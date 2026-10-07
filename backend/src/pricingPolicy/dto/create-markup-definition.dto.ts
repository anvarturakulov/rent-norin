import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateMarkupDefinitionDto {
  @ApiProperty({ example: "LOGISTICS" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: "code must be UPPER_SNAKE_CASE (latin letters, digits, underscore)",
  })
  code: string;

  @ApiProperty({ example: "Наценка на логистику" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 60, required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: "true — включается в себестоимость; false — информативная",
  })
  @IsOptional()
  @IsBoolean()
  includesInCost?: boolean;
}
