import { useAppContext } from '@/app/context/app.context';
import { useCallback } from 'react';
import styles from './selectMaterialResponsiblePerson.module.css';
import cn from 'classnames';
import { TypeReference, ReferenceModel } from '@/app/interfaces/reference.interface';
import { useSelectReferenceData } from '../selectReferenceInForm/hooks/useSelectReferenceData';

interface SelectMaterialResponsiblePersonProps {
  label?: string;
  visible?: boolean;
  className?: string;
}

export const SelectMaterialResponsiblePerson = ({ 
  label = 'Материально ответственное лицо', 
  visible = true, 
  className 
}: SelectMaterialResponsiblePersonProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { contentName } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;

  // Используем хук для загрузки данных работников
  const { data, isLoading, error } = useSelectReferenceData({
    typeReference: TypeReference.WORKERS,
    type: 'materialResponsiblePerson',
    contentName,
    mainData,
    token
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!currentDocument || !currentDocument.docValues) return;

    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
    const updatedDocument = {
      ...currentDocument,
      docValues: {
        ...currentDocument.docValues,
        materialResponsiblePersonId: isNaN(value as any) ? undefined : value,
      },
    };

    setMainData('currentDocument', updatedDocument);
  }, [currentDocument, setMainData]);

  if (!visible) return <></>;

  if (isLoading) {
    return (
      <div className={cn(styles.box, className)}>
        {label && <div className={styles.label}>{label}</div>}
        <select className={styles.select} disabled>
          <option>Загрузка...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(styles.box, className)}>
        {label && <div className={styles.label}>{label}</div>}
        <select className={styles.select} disabled>
          <option>Ошибка загрузки</option>
        </select>
      </div>
    );
  }

  return (
    <div className={cn(styles.box, className)}>
      {label && <div className={styles.label}>{label}</div>}
      <select
        className={styles.select}
        value={currentDocument?.docValues?.materialResponsiblePersonId || ''}
        onChange={handleChange}
      >
        <option value="">Танланмаган</option>
        {data.map((item: ReferenceModel) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
};

