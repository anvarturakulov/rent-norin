import React, { memo } from 'react';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DEFAULT_OPTION } from '../constants/select.constants';
import styles from '../selectReferenceInForm.module.css';

interface SelectOptionsProps {
  data: ReferenceModel[];
}

const SelectOptions = memo<SelectOptionsProps>(({ data }) => {
  return (
    <>
      {/* Опция по умолчанию */}
      <option 
        value={DEFAULT_OPTION.value} 
        data-type={DEFAULT_OPTION.dataType} 
        data-id={DEFAULT_OPTION.dataId}
        className={styles.chooseMe}
        key={-1}
      >
        {DEFAULT_OPTION.label}
      </option>
      
      {/* Опции данных */}
      {data.map((item: ReferenceModel) => (
        !item.isFolder &&
        <option 
          className={styles.option}
          key={item.id}
          value={item.name}
          data-type={item.typeReference} 
          data-id={item.id}
        >
          {item.name}
        </option>  
      ))}
    </>
  );
});

SelectOptions.displayName = 'SelectOptions';

export default SelectOptions; 