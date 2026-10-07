import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from "class-validator";
import { ClientContractItemKind } from "src/interfaces/client-contract.interface";

export class ClientContractItemLineDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;

  @ApiProperty({ enum: ClientContractItemKind })
  @IsEnum(ClientContractItemKind)
  lineKind: ClientContractItemKind;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  analiticId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  count: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  saleDocId?: number | null;
}
