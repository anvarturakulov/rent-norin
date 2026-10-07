import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";

export const TDUSD = async (
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
      "USD",
      startDate,
      endDate,
      schet,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      null,
      null,
      null,
      null,
      undefined,
      enterpriseId,
    )
  ).result;
};
