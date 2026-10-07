import { PartialType } from "@nestjs/swagger";
import { CreateProductCalculationDto } from "./create-product-calculation.dto";

export class UpdateProductCalculationDto extends PartialType(
  CreateProductCalculationDto,
) {}
