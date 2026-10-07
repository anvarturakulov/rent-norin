import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsInt } from "class-validator";

function normalizeWorkIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    const n = parseInt(String(v).trim(), 10);
    return n;
  });
}

export class SetLineOrderDto {
  @ApiProperty({
    type: [Number],
    description:
      "ID работ в нужном порядке (полный список по заявке); пустой массив только если работ нет",
  })
  @Transform(({ value }) => normalizeWorkIds(value))
  @IsArray()
  @IsInt({ each: true })
  workIds: number[];
}
