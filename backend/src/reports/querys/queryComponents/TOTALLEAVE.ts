import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";

export const TOTALLEAVE = async (
  schet: Schet | null,
  typeQuery: TypeQuery | null,
  startDate: number | null,
  endDate: number | null,
  firstSubcontoId: number | null,
  secondSubcontoId: number | null,
  thirdSubcontoId: number | null,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  return (
    await oborotsService.getOborotByDate(
      "TOTAL",
      0,
      Number(endDate),
      null,
      null,
      null,
      null,
      schet,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      undefined,
      enterpriseId,
    )
  ).result;
};
