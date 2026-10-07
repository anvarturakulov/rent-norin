import { OborotType, ReportType, Schet } from '@/app/interfaces/report.interface'
import { isMatOborotSchet } from './matOborotTypes'

export const getSchetListFoSecondSunconts = (contentName: string, schet: Schet): Array<Schet> => {
  switch (contentName) {
    case ReportType.Personal:
      return [Schet.S67]
    case ReportType.DelivererPersonal:
      return [Schet.S64]
    case ReportType.MatOborot:
      return isMatOborotSchet(schet) ? [schet] : [Schet.S10]
    case ReportType.Oborotka:
      switch (schet){
        case Schet.S20 : return [Schet.S20];
        case Schet.S50: return [Schet.S50];
        default: return [Schet.S00];
      }
    default:
      return [Schet.S00]
  }
}
