import { UserRoles } from "@/app/interfaces/user.interface"

export const userRolesList = [
  { name: '', title: 'Фойдаланувчи турини танланг' },
  { name: UserRoles.ADMINGLOBAL, title: 'ADMINGLOBAL' },
  { name: UserRoles.HEADGLOBAL, title: 'HEADGLOBAL' },
  { name: UserRoles.HEADCOMPANY, title: 'HEADCOMPANY' },
  { name: UserRoles.GLAVBUX, title: 'GLAVBUX' },
  { name: UserRoles.GUEST, title: 'GUEST' },
  { name: UserRoles.KASSIR, title: 'KASSIR' },
  { name: UserRoles.KASSIRGLOBAL, title: 'KASSIRGLOBAL' },
  { name: UserRoles.ZAVSKLAD, title: 'ZAVSKLAD' },
  { name: UserRoles.SCALING, title: 'SCALING' },
  { name: UserRoles.DRAWING, title: 'DRAWING' },
  { name: UserRoles.DELIVERY, title: 'DELIVERY' },
  { name: UserRoles.MARKETING, title: 'MARKETING' },
  { name: UserRoles.PRODUCTION, title: 'PRODUCTION' },
]

export interface DataForUserSelect {
  name: string,
  title: string
}