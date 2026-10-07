import React, { memo } from 'react';
import cn from 'classnames';
import IcoTrash from './ico/trash.svg';
import { PereodicModel } from '@/app/interfaces/reference.interface';
import { secondsToDateString } from '../../documents/document/doc/helpers/doc.functions';
import styles from './pereodicsList.module.css';

interface PereodicTableRowProps {
  item: PereodicModel;
  index: number;
  className?: string;
  onDoubleClick: (id: number | undefined) => void;
  onDeleteClick: (id: number | undefined) => void;
}

const PereodicTableRow = memo<PereodicTableRowProps>(({
  item,
  index,
  className,
  onDoubleClick,
  onDeleteClick
}) => {
  return (
    <tr 
      onDoubleClick={() => onDoubleClick(item.id)} 
      className={cn(className, {
        [styles.trRow]: true,
      })}   
    >
      <td className={styles.rowId}>{index + 1}</td>
      <td className={styles.date}>{secondsToDateString(Number(item.date))}</td>
      <td className={styles.value}>{item?.value}</td>
      <td className={styles.rowAction}>
        <IcoTrash
          className={styles.icoTrash}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDeleteClick(item?.id);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onDeleteClick(item?.id);
            }
          }}
          aria-label="Ўчириш"
        />
      </td>
    </tr>
  );
});

PereodicTableRow.displayName = 'PereodicTableRow';

export default PereodicTableRow; 