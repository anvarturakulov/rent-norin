import { ReferenceModel } from '@/app/interfaces/reference.interface'

export const getPropertySubconto = (data: any, subcontoId: number | undefined) => {
  let elem
  if (data && data.length > 0 && subcontoId) {
   elem = data.find((item: ReferenceModel) => item.id == subcontoId)
  }

  return {
    ...elem
  }
}