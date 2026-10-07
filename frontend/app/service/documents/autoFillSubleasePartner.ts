import {
  ReferenceModel,
  TypeReference,
  TypeSECTION,
} from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';

export type SubleasePartnerStorage = {
  partnerId: number;
  storageId: number;
  storageName: string;
};

export const SUBLEASE_STORAGE_MISSING_MSG =
  'Субаренда омбори топилмади. Цех/омборда тип «Субаренда (ҳамкор омбори)» яратинг ва ҳамкорни белгиланг.';

/** Первый склад PARTNER_TOOLS с partnerId из уже загруженного списка. */
export const pickDefaultSubleasePartnerStorage = (
  references: ReferenceModel[] | null | undefined,
  enterpriseId?: number | null,
): SubleasePartnerStorage | null => {
  if (!Array.isArray(references) || !references.length) {
    return null;
  }

  const storages = references
    .filter((s) => {
      if (
        s.typeReference !== TypeReference.STORAGES ||
        s.isFolder ||
        s.refValues?.markToDeleted ||
        s.refValues?.typeSection !== TypeSECTION.PARTNER_TOOLS ||
        !(Number(s.refValues?.partnerId) > 0)
      ) {
        return false;
      }
      if (enterpriseId != null && Number(enterpriseId) > 0) {
        return Number(s.enterpriseId) === Number(enterpriseId);
      }
      return true;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  const first = storages[0];
  if (!first?.id) {
    return null;
  }

  return {
    partnerId: Number(first.refValues!.partnerId),
    storageId: Number(first.id),
    storageName: first.name || '',
  };
};

/**
 * Первый склад PARTNER_TOOLS предприятия с заполненным partnerId
 * (пока в проекте один партнёр субаренды).
 */
export const findDefaultSubleasePartnerStorage = async (
  token: string | undefined,
  enterpriseId: number | null | undefined,
): Promise<SubleasePartnerStorage | null> => {
  if (!token || enterpriseId == null || Number(enterpriseId) <= 0) {
    return null;
  }

  const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/STORAGES?enterpriseId=${enterpriseId}`;
  const data = await getDataForSwr(url, token);
  return pickDefaultSubleasePartnerStorage(data as ReferenceModel[], enterpriseId);
};
