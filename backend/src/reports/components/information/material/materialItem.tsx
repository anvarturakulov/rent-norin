import { Schet, TypeQuery } from 'src/interfaces/report.interface';
import { OborotsService } from 'src/oborots/oborots.service';
import { queryKor } from 'src/reports/querys/queryKor';

export const materialItem = async ( 
  data: any,
  startDate: number | null,
  endDate: number | null,
  title: string, 
  materialId: number, 
  obortsService: OborotsService,
  enterpriseId?: number | null
) => {    
  const idZagatovka27 = -1;

  const promises = [
    queryKor(Schet.S21, Schet.S23, TypeQuery.OKK, startDate, endDate, null, null, null, obortsService, enterpriseId), // countComeHS
    queryKor(Schet.S20, Schet.S21, TypeQuery.OKK, startDate, endDate, null, null, null, obortsService, enterpriseId), // countLeaveHS
    queryKor(Schet.S20, Schet.S10, TypeQuery.OKK, startDate, endDate, null, materialId, null, obortsService, enterpriseId), // count часть 1
    queryKor(Schet.S23, Schet.S10, TypeQuery.OKK, startDate, endDate, null, materialId, null, obortsService, enterpriseId), // count часть 2
    queryKor(Schet.S20, Schet.S10, TypeQuery.OKS, startDate, endDate, null, materialId, null, obortsService, enterpriseId), // summa часть 1
    queryKor(Schet.S23, Schet.S10, TypeQuery.OKS, startDate, endDate, null, materialId, null, obortsService, enterpriseId), // summa часть 2
  ];

  const [
    countComeHS,
    countLeaveHS,
    countPart1,
    countPart2,
    summaPart1,
    summaPart2,
  ] = await Promise.all(promises);

  let count = countPart1 + countPart2;
  let summa = summaPart1 + summaPart2;

  if (count == 0 && summa == 0) return {};

  let element = {
    title,
    count,
    summa
  };
    
  return element;
};