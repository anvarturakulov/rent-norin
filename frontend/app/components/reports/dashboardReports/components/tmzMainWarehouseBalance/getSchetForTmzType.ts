import { TypeTMZ } from '@/app/interfaces/reference.interface';
import { Schet } from '@/app/interfaces/report.interface';

export const getSchetForTmzType = (typeTMZ?: TypeTMZ): Schet | null => {
  switch (typeTMZ) {
    case TypeTMZ.MATERIAL:
      return Schet.S10;
    case TypeTMZ.PRODUCT:
      return Schet.S28;
    case TypeTMZ.HALFSTUFF:
      return Schet.S21;
    case TypeTMZ.TOOLS:
      return Schet.S11;
    case TypeTMZ.TOVAR:
      return Schet.S29;
    default:
      return null;
  }
};
