import { Sequelize } from "sequelize-typescript";
import { Schet, TypeQuery } from "src/interfaces/report.interface";
import { BadRequestException } from "@nestjs/common";
import { ODS } from "./queryKorComponents/ODS";
import { ODK } from "./queryKorComponents/ODK";
import { OKS } from "./queryKorComponents/OKS";
import { OKK } from "./queryKorComponents/OKK";
import { OborotsService } from "src/oborots/oborots.service";
import { ODU } from "./queryKorComponents/ODU";
import { OKU } from "./queryKorComponents/OKU";

function hasKey(obj, key) {
  return obj !== null && typeof obj === "object" && key in obj;
}

export const queryKor = async (
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
): Promise<number> => {
  if (!oborotsService) {
    console.error("oborotsService is undefined");
    throw new BadRequestException("OborotsService is not provided");
  }

  try {
    switch (typeQuery) {
      case TypeQuery.ODS:
        const odsResult = await ODS(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return odsResult || 0;
      case TypeQuery.ODU:
        const oduResult = await ODU(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return oduResult || 0;
      case TypeQuery.ODK:
        const odkResult = await ODK(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return odkResult || 0;
      case TypeQuery.OKS:
        const oksResult = await OKS(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return oksResult || 0;
      case TypeQuery.OKK:
        const okkResult = await OKK(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return okkResult || 0;
      case TypeQuery.OKU:
        const okuResult = await OKU(
          debet,
          kredit,
          typeQuery,
          startDate,
          endDate,
          firstSubcontoId,
          secondSubcontoId,
          thirdSubcontoId,
          oborotsService,
          enterpriseId,
        );
        return okuResult || 0;
      default:
        return 0;
    }
  } catch (error) {
    throw new BadRequestException("Database error: " + error.message);
  }
};
