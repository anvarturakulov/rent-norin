import { QuerySimple } from "src/interfaces/report.interface";
import { GetEntriesQueryDto } from "../dto/entry-query.dto";

export const requestTransform = (query: GetEntriesQueryDto): QuerySimple => {
  return {
    reportType: query.reportType || null,
    typeQuery: query.typeQuery || null,
    sectionId: query.sectionId || null,
    tmzId: query.tmzId || null,
    schet: query.schet || null,
    dk: query.dk || null,
    workerId: query.workerId || null,
    name: query.name || null,
    startDate: query.startDate || null,
    endDate: query.endDate || null,
    firstSubcontoId:
      query.firstSubcontoId !== undefined && query.firstSubcontoId !== null
        ? query.firstSubcontoId
        : null,
    secondSubcontoId:
      query.secondSubcontoId !== undefined && query.secondSubcontoId !== null
        ? query.secondSubcontoId
        : null,
    thirdSubcontoId:
      query.thirdSubcontoId !== undefined && query.thirdSubcontoId !== null
        ? query.thirdSubcontoId
        : null,
    debetFirstSubcontoId: query.debetFirstSubcontoId || null,
    debetSecondSubcontoId: query.debetSecondSubcontoId || null,
    debetThirdSubcontoId: query.debetThirdSubcontoId || null,
    kreditFirstSubcontoId: query.kreditFirstSubcontoId || null,
    kreditSecondSubcontoId: query.kreditSecondSubcontoId || null,
    kreditThirdSubcontoId: query.kreditThirdSubcontoId || null,
    partnerType: query.partnerType || null,
    reportYear: query.reportYear ?? null,
    enterpriseId:
      query.enterpriseId !== undefined ? query.enterpriseId || null : null,
  };
};
