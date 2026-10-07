import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from "class-validator";
import { UpdateCreateReferenceDto } from "./updateCreateReference.dto";

export class CreateManyReferencesDto {
  @ApiProperty({
    type: [UpdateCreateReferenceDto],
    description: "Пакет справочников для создания (до 200 за раз)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UpdateCreateReferenceDto)
  items: UpdateCreateReferenceDto[];
}
