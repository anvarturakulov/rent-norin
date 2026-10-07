import { useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import useSWR from 'swr';

export const useEnterpriseName = (): string | null => {
  const { mainData } = useAppContext();
  const { user } = mainData.users;
  const token = user?.token;
  
  const isGlobal = useMemo(() => {
    return user?.role && isGlobalRole(user.role);
  }, [user?.role]);

  const canUseSelectedEnterprise = useMemo(() => {
    return isGlobal || user?.superKassir === true;
  }, [isGlobal, user?.superKassir]);

  const { data: enterprises } = useSWR(
    token ? 'enterprises' : null,
    () => getEnterprises(token)
  );

  const selectedEnterpriseId = mainData.report?.selectedEnterpriseId;
  const isAllEnterprisesSelected =
    selectedEnterpriseId === null || selectedEnterpriseId === undefined;

  // Определяем ID предприятия для отображения
  const enterpriseId = useMemo(() => {
    if (canUseSelectedEnterprise && !isAllEnterprisesSelected) {
      const rawId = selectedEnterpriseId;
      return typeof rawId === 'object' && rawId !== null
        ? (rawId as any)?.id ?? null
        : rawId;
    }
    if (canUseSelectedEnterprise && isAllEnterprisesSelected) {
      return null;
    }
    return user?.enterpriseId;
  }, [canUseSelectedEnterprise, selectedEnterpriseId, isAllEnterprisesSelected, user?.enterpriseId]);

  // Получаем название предприятия
  const enterpriseName = useMemo(() => {
    if (canUseSelectedEnterprise && isAllEnterprisesSelected) {
      return 'Барча корхоналар';
    }
    if (!enterpriseId || !enterprises || !Array.isArray(enterprises)) {
      return null;
    }
    const enterprise = enterprises.find((item: any) => item.id === enterpriseId);
    return enterprise?.name || null;
  }, [canUseSelectedEnterprise, isAllEnterprisesSelected, enterpriseId, enterprises, selectedEnterpriseId]);

  return enterpriseName;
};

