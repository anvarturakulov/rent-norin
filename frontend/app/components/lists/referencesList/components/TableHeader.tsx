import React, { memo } from 'react';
import cn from 'classnames';
import {
  REFERENCE_TYPE_CONFIG,
  TMZ_LIST_SHOW_ARTICLE,
  TMZ_LIST_SHOW_COMMENT,
  TMZ_LIST_SHOW_ENTERPRISE_CODE,
  TMZ_LIST_SHOW_ID,
} from '../constants';
import { useAppContext } from '@/app/context/app.context';
import { UserRoles } from '@/app/interfaces/user.interface';
import styles from '../referencesList.module.css';
import type { TmzImageSortMode } from '../referencesList';

interface TableHeaderProps {
  referenceType: string;
  imageSort?: TmzImageSortMode;
  onToggleImageSort?: () => void;
}

function imageSortIndicator(sort: TmzImageSortMode): string {
  if (sort === 'noImageFirst') return ' ↓';
  if (sort === 'hasImageFirst') return ' ↑';
  return '';
}

export const TableHeader = memo<TableHeaderProps>(({
  referenceType,
  imageSort = 'none',
  onToggleImageSort,
}) => {
  const { mainData } = useAppContext();
  const { user } = mainData.users;
  const isAdmin = user?.role === UserRoles.ADMINGLOBAL;
  const isPartners = referenceType === 'PARTNERS';
  const config = REFERENCE_TYPE_CONFIG[referenceType as keyof typeof REFERENCE_TYPE_CONFIG];
  const isTMZ = referenceType === 'TMZ';
  const isWorks = referenceType === 'WORKS';

  return (
    <tr key={-1}>
      <th className={styles.iconColumn}></th>
      {(!isTMZ || TMZ_LIST_SHOW_ID) && <th className={styles.rowId}>ID</th>}
      {isTMZ && TMZ_LIST_SHOW_ARTICLE && (
        <th className={cn(styles.types, styles.article)}>Артикул</th>
      )}
      <th
        className={cn(
          styles.imageColumn,
          isTMZ && styles.imageColumnSortable,
          isTMZ && imageSort !== 'none' && styles.imageColumnSorted,
        )}
        onDoubleClick={isTMZ ? onToggleImageSort : undefined}
        title={
          isTMZ
            ? 'Икки марта босинг: расм бўйича (қўшимча ТМБ тури, ном) / ўчириш'
            : undefined
        }
      >
        Расм{isTMZ ? imageSortIndicator(imageSort) : null}
      </th>
      <th className={cn(styles.name, isPartners && styles.namePartners)}>Номи</th>
      {config && config.columns.map((column, index) => {
        const field = config.fields[index];
        return (
          <th key={index} className={cn(styles.types, styles[field as keyof typeof styles])}>
            {column}
          </th>
        );
      })}
      {isAdmin && isTMZ && TMZ_LIST_SHOW_ENTERPRISE_CODE && (
        <th className={styles.enterpriseIdColumn}>Код орг.</th>
      )}
      {isAdmin && !isTMZ && <th className={styles.enterpriseColumn}>Организация</th>}
      {!isPartners && !isWorks && (!isTMZ || TMZ_LIST_SHOW_COMMENT) && (
        <th className={styles.comment}>Изох</th>
      )}
      <th className={styles.rowAction}>...</th>
    </tr>
  );
});

TableHeader.displayName = 'TableHeader'; 