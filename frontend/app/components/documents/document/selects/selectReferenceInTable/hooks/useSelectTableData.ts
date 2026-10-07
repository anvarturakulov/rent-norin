import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';
import { ReferenceModel, TypeReference, TypePartners, TypeSECTION, TypeTMZ } from '@/app/interfaces/reference.interface';
import { FILTER_CONDITIONS } from '../constants/selectTable.constants';

interface UseSelectTableDataProps {
  typeReference: TypeReference;
  token: string | undefined;
  enterpriseId?: number | null;
  typePartners?: TypePartners;
  typeSection?: TypeSECTION;
  /** Фильтр TMZ; по умолчанию MATERIAL */
  typeTMZ?: TypeTMZ;
  matchLinkedEnterprise?: boolean;
}

export const useSelectTableData = ({
  typeReference,
  token,
  enterpriseId,
  typePartners,
  typeSection,
  typeTMZ,
  matchLinkedEnterprise,
}: UseSelectTableDataProps) => {
  const url = enterpriseId 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}?enterpriseId=${enterpriseId}`
    : `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}`;
  const { data, error, isLoading } = useSWR(url, (url) => getDataForSwr(url, token));

  // Мемоизируем фильтрованные и отсортированные данные
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let filtered = data
      .filter(FILTER_CONDITIONS.NOT_DELETED);
    
    // Фильтр typeTMZ применяется только для справочника TMZ
    if (typeReference === TypeReference.TMZ) {
      const tmzFilter = typeTMZ ?? TypeTMZ.MATERIAL;
      filtered = filtered.filter(
        (item: ReferenceModel) => item.refValues?.typeTMZ === tmzFilter,
      );
    }
    
    filtered = filtered.sort(sortByName);

    // Если указан typePartners, фильтруем по типу партнера
    if (typePartners && typeReference === TypeReference.PARTNERS) {
      filtered = filtered.filter((ref: ReferenceModel) => ref.refValues?.typePartners === typePartners);
    }

    // Если указан typeSection, фильтруем по типу секции (для STORAGES)
    if (typeSection && typeReference === TypeReference.STORAGES) {
      filtered = filtered.filter((ref: ReferenceModel) => ref.refValues?.typeSection === typeSection);
    }

    // Фильтрация по enterpriseId для WORKERS (показываем только своих сотрудников)
    if (typeReference === TypeReference.WORKERS && enterpriseId !== undefined && enterpriseId !== null) {
      filtered = filtered.filter((ref: ReferenceModel) => 
        ref.enterpriseId === enterpriseId || ref.enterpriseId === null
      );
    }

    if (matchLinkedEnterprise && typeReference === TypeReference.STORAGES && enterpriseId) {
      filtered = filtered.filter((ref: ReferenceModel) =>
        ref.enterpriseId === undefined ||
        ref.enterpriseId === null ||
        ref.enterpriseId !== enterpriseId
      );
    }

    return filtered;
  }, [data, typePartners, typeReference, typeSection, typeTMZ, enterpriseId, matchLinkedEnterprise]);

  return {
    data: filteredData,
    rawData: data,
    error,
    isLoading,
    isEmpty: !filteredData || filteredData.length === 0
  };
}; 