import { Schet } from '@/app/interfaces/report.interface';

export const getTitleBySchet = (schet: Schet): string => {
  switch (schet) {
    case Schet.S10:
      return 'Хом ашёлар'
    case Schet.S21:
      return 'Ярим тайёр махсулотлар'
    case Schet.S28:
      return 'Тайёр махсулотлар'
    default :
      return ''
  }
}