import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from "class-validator";
import { CreateRentalContractDto } from "./create-rental-contract.dto";

export class CreateManyRentalContractsDto {
  @ApiProperty({
    type: [CreateRentalContractDto],
    description: "Пакет договоров аренды (до 200 за раз)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateRentalContractDto)
  items: CreateRentalContractDto[];
}
