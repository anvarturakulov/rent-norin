import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { OborotsService } from "src/oborots/oborots.service";

export const OKS = async (
  debet: Schet,
  kredit: Schet,
  typeQuery: TypeQuery,
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
      startDate,
      endDate,
      debet,
      null,
      null,
      null,
      kredit,
      firstSubcontoId,
      secondSubcontoId,
      thirdSubcontoId,
      undefined,
      enterpriseId,
    )
  ).result;
};
