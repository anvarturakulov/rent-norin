import { useAppContext } from '@/app/context/app.context';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import styles from '../selectMaterialResponsiblePerson/selectMaterialResponsiblePerson.module.css';
import docSelectStyles from '../selectReferenceInForm/selectReferenceInForm.module.css';
import cn from 'classnames';
import { TypeReference, ReferenceModel } from '@/app/interfaces/reference.interface';
import { DocSTATUS } from '@/app/interfaces/document.interface';
import { useSelectReferenceData } from '../selectReferenceInForm/hooks/useSelectReferenceData';
import { isInlineQuickAddBlocked } from '@/app/components/reference/inlineReferenceQuickAddGuard';

interface SelectDelivererProps {
  label?: string;
  visible?: boolean;
  className?: string;
}

const generateInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deliverer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const SelectDeliverer = ({
  label = 'Доставщик',
  visible = true,
  className,
}: SelectDelivererProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { currentDocument } = mainData.document;
  const { contentName } = mainData.document;
  const { user } = mainData.users;
  const token = user?.token;
  const instanceId = useMemo(() => generateInstanceId(), []);
  const mainDataRef = useRef(mainData);
  mainDataRef.current = mainData;
  const [createdItems, setCreatedItems] = useState<ReferenceModel[]>([]);

  const { data, isLoading, error } = useSelectReferenceData({
    typeReference: TypeReference.DELIVERERS,
    type: 'deliverer',
    contentName,
    mainData,
    token,
  });

  const disabled = currentDocument?.docStatus
    ? currentDocument.docStatus !== DocSTATUS.OPEN
    : false;

  const options = useMemo(() => {
    const list = [...(data || [])];
    for (const item of createdItems) {
      if (item.id && !list.some((x) => x.id === item.id)) {
        list.push(item);
      }
    }
    return list;
  }, [data, createdItems]);

  const delivererId = currentDocument?.docValues?.delivererId;
  const canQuickAdd = !disabled;
  const canQuickEdit = canQuickAdd && typeof delivererId === 'number' && delivererId > 0;

  const setDelivererId = useCallback(
    (id: number | undefined) => {
      const doc = mainDataRef.current.document.currentDocument;
      if (!doc?.docValues || !setMainData) return;
      setMainData('currentDocument', {
        ...doc,
        docValues: {
          ...doc.docValues,
          delivererId: id,
        },
      });
    },
    [setMainData],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (disabled) return;
      const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
      setDelivererId(Number.isNaN(value as number) ? undefined : value);
    },
    [disabled, setDelivererId],
  );

  const handleOpenInlineCreate = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!setMainData || disabled) return;
      if (isInlineQuickAddBlocked()) return;
      setMainData('reference.lastCreatedForInline', null);
      setMainData('showMessageWindow', false);
      setMainData('reference.inlineCreation', {
        typeReference: TypeReference.DELIVERERS,
        instanceId,
      });
    },
    [setMainData, disabled, instanceId],
  );

  const handleOpenInlineEdit = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!setMainData || disabled) return;
      if (isInlineQuickAddBlocked()) return;
      const referenceId = currentDocument?.docValues?.delivererId;
      if (typeof referenceId !== 'number' || referenceId <= 0) return;
      setMainData('reference.lastCreatedForInline', null);
      setMainData('showMessageWindow', false);
      setMainData('reference.inlineCreation', {
        typeReference: TypeReference.DELIVERERS,
        instanceId,
        referenceId,
      });
    },
    [setMainData, disabled, instanceId, currentDocument?.docValues?.delivererId],
  );

  const lastCreatedForInline = mainData.reference?.lastCreatedForInline;
  useEffect(() => {
    if (!lastCreatedForInline) return;
    if (lastCreatedForInline.instanceId !== instanceId) return;

    const created = lastCreatedForInline.reference;
    if (!created || typeof created.id !== 'number') {
      setMainData?.('reference.lastCreatedForInline', null);
      return;
    }

    setCreatedItems((prev) => {
      if (prev.some((p) => p.id === created.id)) return prev;
      return [...prev, created];
    });
    setDelivererId(created.id);
    setMainData?.('reference.lastCreatedForInline', null);
  }, [lastCreatedForInline, instanceId, setDelivererId, setMainData]);

  if (!visible) return <></>;

  const selectControl = (
    <select
      className={styles.select}
      value={delivererId || ''}
      onChange={handleChange}
      disabled={disabled || isLoading || Boolean(error)}
    >
      {isLoading && <option>Загрузка...</option>}
      {error && !isLoading && <option>Ошибка загрузки</option>}
      {!isLoading && !error && (
        <>
          <option value="">Танланмаган</option>
          {options.map((item: ReferenceModel) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </>
      )}
    </select>
  );

  return (
    <div className={cn(styles.box, className)}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={docSelectStyles.selectRow}>
        <div className={docSelectStyles.customSelectContainer}>{selectControl}</div>
        {canQuickEdit && (
          <button
            type="button"
            className={docSelectStyles.editButton}
            onClick={handleOpenInlineEdit}
            onMouseDown={(e) => e.preventDefault()}
            title="Танланганни таҳрирлаш"
            tabIndex={-1}
          >
            ✎
          </button>
        )}
        {canQuickAdd && (
          <button
            type="button"
            className={docSelectStyles.plusButton}
            onClick={handleOpenInlineCreate}
            onMouseDown={(e) => e.preventDefault()}
            title="Янги доставщик кушиш"
            tabIndex={-1}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};
