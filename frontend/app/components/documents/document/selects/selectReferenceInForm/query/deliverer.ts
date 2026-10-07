import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { Maindata } from '@/app/context/app.context.interfaces';

export const deliverer = (
  item: ReferenceModel,
  type: string,
  _contentName: string,
  typeReference: TypeReference,
  mainData: Maindata,
): boolean => {
  if (type !== 'deliverer') return false;
  if (typeReference !== TypeReference.DELIVERERS) return false;

  const { user } = mainData.users;
  const userEnterpriseId = user?.enterpriseId;
  const itemEnterpriseId = item.enterpriseId;

  return !item.isFolder && (itemEnterpriseId === userEnterpriseId || itemEnterpriseId === null);
};
