'use client';
import { useAppContext } from '@/app/context/app.context';
import { useMemo } from 'react';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { getInformation } from '@/app/service/reports/getInformation';
import useSWR from 'swr';
import styles from './enterpriseSelector.module.css';
import cn from 'classnames';
import { Maindata } from '@/app/context/app.context.interfaces';

export const EnterpriseSelector = ({ className, ...props }: { className?: string }): JSX.Element | null => {
  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const token = user?.token;
  
  const isGlobal = useMemo(() => {
    return user?.role && isGlobalRole(user.role);
  }, [user?.role]);

  const canSelectEnterprise = useMemo(() => {
    return isGlobal || user?.superKassir === true;
  }, [isGlobal, user?.superKassir]);

  const { data: enterprises } = useSWR(
    token && canSelectEnterprise ? 'enterprises' : null,
    () => getEnterprises(token)
  );

  // Используем значение из mainData как источник истины
  // Нормализуем currentEnterpriseId: извлекаем ID, если это объект
  const rawEnterpriseId = mainData.report?.selectedEnterpriseId ?? null;
  const currentEnterpriseId = typeof rawEnterpriseId === 'object' && rawEnterpriseId !== null 
    ? (rawEnterpriseId as any)?.id ?? null
    : rawEnterpriseId;

  // Обновляем глобальное состояние только при изменении пользователем
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newEnterpriseId = value === 'all' ? null : parseInt(value, 10);
    
    // Нормализуем для сравнения: если newEnterpriseId === null, сравниваем с null
    // Если newEnterpriseId - число, сравниваем нормализованные значения
    const normalizedCurrent = currentEnterpriseId === null ? null : Number(currentEnterpriseId);
    const normalizedNew = newEnterpriseId === null ? null : Number(newEnterpriseId);
    
    // Обновляем только если значение действительно изменилось
    if (normalizedNew !== normalizedCurrent && setMainData) {
      // Используем полный путь для гарантии правильного обновления
      setMainData('report.selectedEnterpriseId', newEnterpriseId);

      const reportType = mainData.report?.dashboardCurrentReportType;
      if (reportType) {
        const updatedMainData: Maindata = {
          ...mainData,
          report: {
            ...mainData.report,
            selectedEnterpriseId: newEnterpriseId,
          },
        };
        getInformation(setMainData, updatedMainData);
      }
    }
  };

  if (!canSelectEnterprise || !enterprises || !Array.isArray(enterprises)) {
    return null;
  }

  return (
    <div className={cn(styles.box, className)} {...props}>
      <label className={styles.label}>Корхона:</label>
      <select
        className={styles.select}
        value={currentEnterpriseId === null || currentEnterpriseId === undefined ? 'all' : currentEnterpriseId.toString()}
        onChange={handleChange}
      >
        <option value="all">Барча корхоналар</option>
        {enterprises
          .filter((enterprise: any) => !enterprise.markToDeleted)
          .map((enterprise: any) => (
            <option key={enterprise.id} value={enterprise.id}>
              {enterprise.name}
            </option>
          ))}
      </select>
    </div>
  );
};

