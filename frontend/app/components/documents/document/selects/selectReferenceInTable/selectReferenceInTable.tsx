import { SelectReferenceInTableProps } from './selectReferenceInTable.props';
import styles from './selectReferenceInTable.module.css';
import { useAppContext } from '@/app/context/app.context';
import { useEffect, useState, useCallback } from 'react';
import { useSelectTableData } from './hooks/useSelectTableData';
import { handleSelectTableChange } from './utils/changeHandlers';
import { getInitialValue } from './utils/initialValue';
import SelectTableOptions from './components/SelectTableOptions';

export const SelectReferenceInTable = ({ 
  selectForReciever, 
  typeReference, 
  itemIndexInTable, 
  currentItemId, 
  typePartners,
  typeSection,
  typeTMZ,
  fieldName,
  onChange,
  noMargin,
  className, 
  matchLinkedEnterprise,
  ...props 
}: SelectReferenceInTableProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const token = user?.token;
  const enterpriseId = user?.enterpriseId;

  // Используем кастомный хук для данных
  const { data, error, isLoading } = useSelectTableData({
    typeReference,
    token,
    enterpriseId,
    typePartners,
    typeSection,
    typeTMZ,
    matchLinkedEnterprise
  });

  // Мемоизируем начальное значение
  const [selected, setSelected] = useState('');

  useEffect(() => {
    // Ищем в отфильтрованном списке, чтобы value всегда совпадал с option
    const initialValue = getInitialValue(data || [], currentItemId);
    setSelected(initialValue);
  }, [data, currentItemId]);

  // Мемоизируем обработчик изменений
  const handleChange = useCallback((e: React.FormEvent<HTMLSelectElement>) => {
    const target = e.currentTarget;
    const strId = target[target.selectedIndex].getAttribute('data-id');
    const id = strId ? +strId : undefined;
    const value = target.value;

    // Обновляем внутренний state компонента
    setSelected(value);
    
    // Если передан onChange callback, вызываем его
    if (typeof onChange === 'function') {
      onChange(id);
    } else {
      // Иначе используем стандартный обработчик
      handleSelectTableChange({
        e,
        itemIndex: itemIndexInTable,
        setMainData,
        mainData,
        setSelected,
        fieldName
      });
    }
  }, [itemIndexInTable, setMainData, mainData, onChange, fieldName]);

  // Состояния загрузки и ошибок
  if (isLoading) {
    return (
      <div className={styles.box}>
        <div className={styles.select}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.box}>
        <div className={styles.select}>Ошибка загрузки данных</div>
      </div>
    );
  }

  return (
    <div className={styles.box}>
      <select
        className={noMargin ? styles.selectNoMargin : styles.select}
        onChange={handleChange}
        {...props}
        value={selected}
      >
        <SelectTableOptions data={data} />
      </select>
    </div>
  );
};