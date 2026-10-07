import React, { memo } from 'react';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DEFAULT_OPTION_DATA } from '../constants/selectTable.constants';
import styles from '../selectReferenceInTable.module.css';

interface SelectTableOptionsProps {
  data: ReferenceModel[];
}

const SelectTableOptions = memo<SelectTableOptionsProps>(({ data }) => {
  return (
    <>
      {/* Опция по умолчанию */}
      <option 
        value={DEFAULT_OPTION_DATA.value}
        data-type={DEFAULT_OPTION_DATA.dataType}
        data-id={DEFAULT_OPTION_DATA.dataId}
        className={styles.chooseMe}
      >
        {DEFAULT_OPTION_DATA.label}
      </option>
      
      {/* Опции данных */}
      {data.map((item: ReferenceModel, key: number) => (
        <option 
          value={item.name}
          data-type={item.typeReference}
          data-id={item.id}
          key={key}
        >
          {item.name}
        </option>
      ))}
    </>
  );
});

SelectTableOptions.displayName = 'SelectTableOptions';

export default SelectTableOptions; 