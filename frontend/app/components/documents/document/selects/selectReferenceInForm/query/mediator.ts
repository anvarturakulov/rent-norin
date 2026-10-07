import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { Maindata } from '@/app/context/app.context.interfaces';

export const mediator = (
  item: ReferenceModel,
  type: string,
  _contentName: string,
  typeReference: TypeReference,
  mainData: Maindata,
): boolean => {
  if (type !== 'mediator') return false;
  if (typeReference !== TypeReference.MEDIATORS) return false;

  const { user } = mainData.users;
  const userEnterpriseId = user?.enterpriseId;
  const itemEnterpriseId = item.enterpriseId;

  return !item.isFolder && (itemEnterpriseId === userEnterpriseId || itemEnterpriseId === null);
};
