import { useMemo } from 'react';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { defaultDocumentTableItem } from '@/app/context/app.context.helpers.constants';
import { DocSTATUS, DocTableItem, DocumentModel } from '@/app/interfaces/document.interface';
import { ReferenceModel, TypePartners, TypeReference, TypeSECTION } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import {
  ADVANCE_LINE_OPTIONS,
  AdvanceLineKind,
  isAdvanceLineFilled,
} from '@/app/service/documents/advanceLines';
import styles from './advanceLinesTable.module.css';

const domain = process.env.NEXT_PUBLIC_DOMAIN;

const msToInput = (value?: number): string => {
  if (!value) return '';
  const date = new Date(Number(value));
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const inputToMs = (value: string): number => {
  if (!value) return 0;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return new Date(year, month - 1, day).getTime();
};

const storageAllowed = (
  item: ReferenceModel,
  kind: AdvanceLineKind,
  user: { enterpriseId?: number | null; superKassir?: boolean } | undefined,
): boolean => {
  if (item.isFolder) return false;
  const section = item.refValues?.typeSection;
  const own = item.enterpriseId != null && item.enterpriseId === user?.enterpriseId;
  if (kind === 'founder') {
    if (section !== TypeSECTION.FOUNDER) return false;
    if (item.enterpriseId == null) return true;
    if (user?.superKassir) return own || item.refValues?.hasBuxgalter !== true;
    return own;
  }
  if (user?.superKassir) {
    if (section !== TypeSECTION.COMMON) return false;
    if (own) return true;
    return item.enterpriseId != null && item.refValues?.hasBuxgalter !== true;
  }
  return (
    own &&
    (section === TypeSECTION.PRODUCTION || section === TypeSECTION.COMMON)
  );
};

const analyticAllowed = (item: ReferenceModel, kind: AdvanceLineKind): boolean => {
  if (item.isFolder) return false;
  if (kind === 'expense') return item.typeReference === TypeReference.CHARGES && !item.refValues?.longCharge;
  if (kind === 'client') return item.refValues?.typePartners === TypePartners.CLIENTS;
  if (kind === 'partner') return item.refValues?.typePartners === TypePartners.SUPPLIERS;
  if (kind === 'worker') return item.typeReference === TypeReference.WORKERS;
  if (kind === 'mediator') {
    return Boolean(item.refValues?.isMediatorDriver || item.refValues?.isMediatorMaster);
  }
  if (kind === 'deliverer') return item.typeReference === TypeReference.DELIVERERS;
  return false;
};

const analyticType = (kind: AdvanceLineKind): TypeReference | null => {
  if (kind === 'expense') return TypeReference.CHARGES;
  if (kind === 'worker') return TypeReference.WORKERS;
  if (kind === 'deliverer') return TypeReference.DELIVERERS;
  if (kind === 'founder') return null;
  return TypeReference.PARTNERS;
};

const RoundSelect = ({
  value,
  options,
  disabled,
  placeholder = 'Танланмаган',
  onChange,
}: {
  value: number;
  options: ReferenceModel[];
  disabled: boolean;
  placeholder?: string;
  onChange: (id: number) => void;
}) => (
  <select
    className={styles.field}
    value={value || 0}
    disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value) || 0)}
  >
    <option value={0}>{placeholder}</option>
    {options.map((item) => (
      <option key={item.id} value={item.id}>
        {item.name}
      </option>
    ))}
  </select>
);

export const AdvanceLinesTable = (): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const currentDocument = mainData.document.currentDocument;
  const user = mainData.users?.user;
  const token = user?.token;
  const issued = currentDocument?.docValues?.advancePhase === 'ISSUED';
  const locked = currentDocument?.docStatus !== DocSTATUS.OPEN;
  const lines = currentDocument?.docTableItems || [];
  const headerTotal = Number(currentDocument?.docValues?.total) || 0;
  const linesTotal = lines
    .filter(isAdvanceLineFilled)
    .reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  const matched = Math.abs(linesTotal - headerTotal) < 0.01;
  const remainder = headerTotal - linesTotal;

  const storagesUrl = token ? `${domain}/api/references/byType/${TypeReference.STORAGES}` : null;
  const { data: storages } = useSWR(storagesUrl, (url) => getDataForSwr(url, token));

  const enterpriseIds = useMemo(() => {
    const ids = new Set<number>();
    if (user?.enterpriseId) ids.add(user.enterpriseId);
    (storages || []).forEach((item: ReferenceModel) => {
      lines.forEach((line) => {
        if (line.lineStorageId && item.id === line.lineStorageId && item.enterpriseId) {
          ids.add(item.enterpriseId);
        }
      });
    });
    return Array.from(ids);
  }, [lines, storages, user?.enterpriseId]);

  const analyticKey = token && enterpriseIds.length
    ? `${domain}|${enterpriseIds.join(',')}`
    : null;
  const { data: analytics } = useSWR(analyticKey, async () => {
    const types = [TypeReference.CHARGES, TypeReference.PARTNERS, TypeReference.WORKERS, TypeReference.DELIVERERS];
    const batches = await Promise.all(
      enterpriseIds.flatMap((enterpriseId) =>
        types.map((type) =>
          getDataForSwr(
            `${domain}/api/references/byType/${type}?enterpriseId=${enterpriseId}`,
            token,
          ),
        ),
      ),
    );
    return batches.flat() as ReferenceModel[];
  });

  const analyticsByType = useMemo(() => {
    const grouped = new Map<TypeReference, ReferenceModel[]>();
    ((analytics || []) as ReferenceModel[]).forEach((item) => {
      const list = grouped.get(item.typeReference) || [];
      list.push(item);
      grouped.set(item.typeReference, list);
    });
    return grouped;
  }, [analytics]);

  const updateLines = (next: DocTableItem[]) => {
    if (!setMainData || !currentDocument) return;
    setMainData('currentDocument', {
      ...currentDocument,
      docTableItems: next,
    } as DocumentModel);
  };

  const patchLine = (index: number, patch: Partial<DocTableItem>) => {
    const next = lines.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...patch } : line,
    );
    updateLines(next);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.title}>Ёпиш қаторлари</div>
        <div className={styles.chips}>
          <span className={styles.chip}>
            Берилган {headerTotal.toLocaleString('ru-RU')}
          </span>
          <span className={issued && !matched ? styles.chipBad : styles.chip}>
            Жами {linesTotal.toLocaleString('ru-RU')}
          </span>
          {issued && !matched && (
            <span className={styles.chipBad}>
              Фарқ {remainder.toLocaleString('ru-RU')}
            </span>
          )}
        </div>
      </div>
      <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colDate}>Сана</th>
            <th className={styles.colKind}>Тури</th>
            <th>Бўлим</th>
            <th>Аналитика</th>
            <th className={styles.colSum}>Сумма</th>
            <th className={styles.colDel}></th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td className={styles.empty} colSpan={6}>
                Қаторлар йўқ
              </td>
            </tr>
          )}
          {lines.map((line, index) => {
            const kind = (line.lineKind || 'expense') as AdvanceLineKind;
            const storageOptions = ((storages || []) as ReferenceModel[]).filter((item) =>
              storageAllowed(item, kind, user),
            );
            const selectedStorage = ((storages || []) as ReferenceModel[]).find(
              (item) => item.id === line.lineStorageId,
            );
            const analyticEnterpriseId = selectedStorage?.enterpriseId || user?.enterpriseId;
            const type = analyticType(kind);
            const analyticLabel =
              ADVANCE_LINE_OPTIONS.find((option) => option.id === kind)?.label || 'Танланмаган';
            const analyticOptions = (type ? analyticsByType.get(type) || [] : []).filter(
              (item) =>
                (item.enterpriseId == null || item.enterpriseId === analyticEnterpriseId) &&
                analyticAllowed(item, kind),
            );
            return (
              <tr key={index}>
                <td>
                  <input
                    className={styles.field}
                    type="date"
                    disabled={locked}
                    value={msToInput(line.settlementDate)}
                    onChange={(event) =>
                      patchLine(index, { settlementDate: inputToMs(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <select
                    className={styles.field}
                    disabled={locked}
                    value={kind}
                    onChange={(event) =>
                      patchLine(index, {
                        lineKind: event.target.value,
                        analiticId: 0,
                        lineStorageId: 0,
                      })
                    }
                  >
                    {ADVANCE_LINE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <RoundSelect
                    key={`${index}-${kind}-storage`}
                    value={Number(line.lineStorageId) || 0}
                    options={storageOptions}
                    disabled={locked}
                    onChange={(id) => patchLine(index, { lineStorageId: id, analiticId: 0 })}
                  />
                </td>
                <td>
                  {kind === 'founder' ? (
                    <span className={styles.dash}>—</span>
                  ) : (
                    <RoundSelect
                      key={`${index}-${kind}-analytic`}
                      value={Number(line.analiticId) || 0}
                      options={analyticOptions}
                      placeholder={analyticLabel}
                      disabled={locked || !line.lineStorageId}
                      onChange={(id) => patchLine(index, { analiticId: id })}
                    />
                  )}
                </td>
                <td>
                  <input
                    className={`${styles.field} ${styles.sum}`}
                    type="number"
                    disabled={locked}
                    value={line.total || ''}
                    onChange={(event) =>
                      patchLine(index, { total: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={locked}
                    title="Ўчириш"
                    onClick={() => updateLines(lines.filter((_, lineIndex) => lineIndex !== index))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {!locked && (
        <button
          type="button"
          className={styles.add}
          onClick={() =>
            updateLines([
              ...lines,
              {
                ...defaultDocumentTableItem,
                analiticId: 0,
                lineKind: 'expense',
                lineStorageId: 0,
                settlementDate: currentDocument?.date || Date.now(),
                total: 0,
              },
            ])
          }
        >
          <span className={styles.addPlus}>+</span>
          Қатор қўшиш
        </button>
      )}
    </div>
  );
};
