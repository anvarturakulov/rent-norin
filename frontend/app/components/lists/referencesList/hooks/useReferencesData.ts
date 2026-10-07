import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { REFERENCE_URLS } from '../constants';
import { useMemo } from 'react';

export const useReferencesData = (referenceType: string, token: string | undefined, selectedEnterpriseId?: number | null) => {
  const url = useMemo(() => {
    if (!referenceType || referenceType.trim() === '') return null;
    
    let baseUrl = REFERENCE_URLS.byType(referenceType);
    
    // Добавляем enterpriseId в query параметры, если он задан
    if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      baseUrl = `${baseUrl}${separator}enterpriseId=${selectedEnterpriseId}`;
    }
    
    return baseUrl;
  }, [referenceType, selectedEnterpriseId]);
  
  return useSWR(url, (url) => getDataForSwr(url, token));
};

export const useAllReferences = (token: string | undefined) => {
  const url = token ? REFERENCE_URLS.all() : null;
  return useSWR(url, (url) => getDataForSwr(url, token));
}; 