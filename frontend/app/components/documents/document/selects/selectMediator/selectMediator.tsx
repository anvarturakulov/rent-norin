import { useAppContext } from '@/app/context/app.context';
import { useCallback } from 'react';
import styles from '../selectMaterialResponsiblePerson/selectMaterialResponsiblePerson.module.css';
import cn from 'classnames';
import { TypeReference, ReferenceModel } from '@/app/interfaces/reference.interface';
import { useSelectReferenceData } from '../selectReferenceInForm/hooks/useSelectReferenceData';

interface SelectMediatorProps {
  label?: string;
  visible?: boolean;
  className?: string;
}

export const SelectMediator = ({
  label = 'Воситачи',
  visible = true,
  className,
}: SelectMediatorProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { contentName } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;

  const { data, isLoading, error } = useSelectReferenceData({
    typeReference: TypeReference.MEDIATORS,
    type: 'mediator',
    contentName,
    mainData,
    token,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!currentDocument?.docValues) return;

      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
      setMainData?.('currentDocument', {
        ...currentDocument,
        docValues: {
          ...currentDocument.docValues,
          mediatorId: Number.isNaN(value as number) ? undefined : value,
        },
      });
    },
    [currentDocument, setMainData],
  );

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
        value={currentDocument?.docValues?.mediatorId || ''}
        onChange={handleChange}
      >
        <option value="">Танланмаган</option>
        {(data || []).map((item: ReferenceModel) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
};
