'use client';

import useSWR from 'swr';
import cn from 'classnames';
import { useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';
import styles from '../reference.module.css';

type Props = {
  value?: number | null;
  onChange: (id: number | null) => void;
  enterpriseId?: number | null;
  disabled?: boolean;
};

export const ReferredByMediatorSelect = ({
  value,
  onChange,
  enterpriseId,
  disabled,
}: Props): JSX.Element => {
  const { mainData } = useAppContext();
  const token = mainData.users.user?.token;
  const url = enterpriseId
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.MEDIATORS}?enterpriseId=${enterpriseId}`
    : `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.MEDIATORS}`;

  const { data } = useSWR(token ? url : null, (fetchUrl) => getDataForSwr(fetchUrl, token));

  const options = useMemo((): ReferenceModel[] => {
    if (!data?.length) return [];
    return (data as ReferenceModel[])
      .filter((item) => !item.isFolder && !item.refValues?.markToDeleted)
      .sort(sortByName);
  }, [data]);

  const selectValue = value != null && options.some((o) => o.id === value) ? String(value) : '';

  return (
    <div className={styles.box}>
      <div className={styles.label}>Воситачи (ким орқали келган)</div>
      <select
        className={cn(styles.select)}
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          onChange(raw === '' ? null : Number(raw));
        }}
      >
        <option value="">—</option>
        {options.map((item) => (
          <option key={item.id} value={String(item.id)}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
};
