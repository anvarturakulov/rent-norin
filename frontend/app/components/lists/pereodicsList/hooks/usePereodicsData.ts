import { useMemo } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { PereodicModel } from '@/app/interfaces/reference.interface';
import { useAppContext } from '@/app/context/app.context';

interface UsePereodicsDataProps {
  referenceId: number | undefined;
  valueName: string | undefined;
  token: string | undefined;
}

export const usePereodicsData = ({ referenceId, valueName, token }: UsePereodicsDataProps) => {
  const { mainData } = useAppContext();
  const enterpriseId = mainData.users.user?.enterpriseId;
  
  // Мемоизируем URL для предотвращения лишних запросов
  const url = useMemo(() => {
    if (!referenceId || !valueName) return null;
    return `${process.env.NEXT_PUBLIC_DOMAIN}/api/pereodic/value?referenceId=${referenceId}&valueName=${valueName}`;
  }, [referenceId, valueName]);

  const { data, mutate, error, isLoading } = useSWR(
    url, 
    (url) => {
      const config: any = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Добавляем enterpriseId в заголовок если есть
      if (enterpriseId !== undefined && enterpriseId !== null) {
        config.headers['x-enterprise-id'] = enterpriseId.toString();
      }
      
      return axios.get(url, config).then(res => res.data);
    }
  );

  // Мемоизируем отсортированные данные
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return [...data].sort((a: PereodicModel, b: PereodicModel) => {
      const dateComparison = a.date - b.date;
      if (dateComparison === 0 && a.id && b.id) {
        return a.id - b.id;
      }
      return dateComparison;
    });
  }, [data]);

  return {
    data: sortedData,
    mutate,
    error,
    isLoading,
    isEmpty: !data || data.length === 0
  };
}; 