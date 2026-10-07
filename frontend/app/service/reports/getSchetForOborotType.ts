import { OborotType, Schet } from '@/app/interfaces/report.interface';

export const getSchetForOborotType = (oborotType: OborotType): Schet => {
  switch (oborotType){
    case OborotType.S20 : return Schet.S20;
    case OborotType.S60: return Schet.S60;
    case OborotType.S50: return Schet.S50;
    case OborotType.S67: return Schet.S67;
    default: return Schet.S00;
  }

}