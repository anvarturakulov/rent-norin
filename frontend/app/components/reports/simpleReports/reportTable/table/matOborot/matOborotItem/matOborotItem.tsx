'use client'
import { MatOborotItemProps } from './matOborotItem.props';
import styles from './matOborotItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import { totalByKey } from '@/app/components/reports/dashboardReports/inform';
import { fetchAnaliticEntries } from '@/app/service/reports/getAnalitic';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import { useAppContext } from '@/app/context/app.context';
import { DEBETKREDIT, EntryItem, Schet } from '@/app/interfaces/report.interface';
import { TypeReference, type ReferenceModel } from '@/app/interfaces/reference.interface';
import { useCallback, useMemo, useRef, useState, Fragment, type ReactNode } from 'react';
import { TmzReportImageModal, type TmzImageSlots } from './TmzReportImageModal';
import { MatOborotEntriesModal } from './MatOborotEntriesModal';
import {
  aggregateMetrics,
  buildChildrenMaps,
  buildTopLevelEntries,
  expandKeyNode,
  expandKeyVirtual,
  getUnreachableElements,
  type MatOborotChildrenMaps,
  type MatOborotTopEntry,
} from './matOborotTree';

function toSlot(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function tmzImageSlots(element: any): TmzImageSlots {
  return [toSlot(element?.imagePath), toSlot(element?.imagePath2), toSlot(element?.imagePath3)];
}

function hasTmzPreviewImages(element: any): boolean {
  return tmzImageSlots(element).some(Boolean);
}

/** Наименование (реквизит name / parentName) — только текст из справочника, без заглушек. */
function pickName(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t) return t;
  }
  return '';
}

function topEntrySortKey(
  entry: MatOborotTopEntry,
  resolveParentName: (id: number) => string
): string {
  if (entry.kind === 'virtual') {
    const n = pickName(entry.children[0]?.parentName, resolveParentName(entry.parentId));
    if (n) return n.toLowerCase();
    return `\uffff${entry.parentId}`;
  }
  return pickName(entry.element?.name).toLowerCase();
}

export const MatOborotItem = ({ item, section }: MatOborotItemProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const [imagePreview, setImagePreview] = useState<{ title: string; slots: TmzImageSlots } | null>(null);
  const [entriesModal, setEntriesModal] = useState<{
    open: boolean;
    loading: boolean;
    title: string;
    entries: EntryItem[];
  }>({ open: false, loading: false, title: '', entries: [] });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const leafCounterRef = useRef(0);

  const openImagePreview = useCallback((element: any) => {
    if (element?.isFolder) return;
    const slots = tmzImageSlots(element);
    if (!slots.some(Boolean)) return;
    setImagePreview({ title: element?.name || '', slots });
  }, []);

  /** Имя элемента справочника по id (папка может не попасть в отчёт по оборотам). */
  const resolveParentName = useCallback(
    (id: number) => {
      const refs = mainData.reference?.allReferences;
      if (!refs?.length) return '';
      const byTmz = refs.find((x: ReferenceModel) => x.id === id && x.typeReference === TypeReference.TMZ);
      if (byTmz?.name?.trim()) return byTmz.name.trim();
      const anyRef = refs.find((x: ReferenceModel) => x.id === id);
      return anyRef?.name?.trim() ?? '';
    },
    [mainData.reference?.allReferences]
  );

  const sortedItems = item?.items
    ? [...item.items].sort((a: any, b: any) => {
        const nameA = a?.name?.toLowerCase() || '';
        const nameB = b?.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      })
    : [];

  const maps: MatOborotChildrenMaps = useMemo(() => buildChildrenMaps(sortedItems), [sortedItems]);

  const topEntriesSorted = useMemo(() => {
    const base = buildTopLevelEntries(sortedItems, maps);
    const unreachable = getUnreachableElements(sortedItems, maps);
    const extra: MatOborotTopEntry[] = unreachable.map((element) => ({ kind: 'root', element }));
    const merged = [...base, ...extra];
    return merged.sort((a, b) =>
      topEntrySortKey(a, resolveParentName).localeCompare(topEntrySortKey(b, resolveParentName))
    );
  }, [sortedItems, maps, resolveParentName]);

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const closeEntriesModal = useCallback(() => {
    setEntriesModal({ open: false, loading: false, title: '', entries: [] });
  }, []);

  const openEntries = useCallback(
    async (element: any, dk: DEBETKREDIT) => {
      const schetByAccountType: Record<string, Schet> = {
        MATERIAL: Schet.S10,
        HALFSTUFF: Schet.S21,
        PRODUCT: Schet.S28,
        TOOLS: Schet.S11,
        TOVAR: Schet.S29,
        TOOLS_AT_CLIENT: Schet.S12,
      };
      const schet = item?.accountType ? schetByAccountType[item.accountType] : undefined;
      const { startDate, endDate } = mainData.report.reportOption;
      const title = element?.name || '';
      setEntriesModal({ open: true, loading: true, title, entries: [] });
      try {
        const entries = await fetchAnaliticEntries(
          mainData,
          item?.sectionId,
          element?.id,
          dk,
          schet,
          { startDate, endDate },
        );
        setEntriesModal({ open: true, loading: false, title, entries });
      } catch {
        setEntriesModal({ open: true, loading: false, title, entries: [] });
      }
    },
    [mainData, item?.sectionId, item?.accountType],
  );

  const handleSelectDocument = useCallback(
    (docId: number) => {
      closeEntriesModal();
      void getDocument(
        docId,
        setMainData,
        mainData.users.user?.token,
        mainData,
        mainData.document.contentName,
      );
    },
    [closeEntriesModal, setMainData, mainData],
  );

  const POKOL = totalByKey('POKOL', sortedItems);
  const POSUM = totalByKey('POSUM', sortedItems);
  const TDKOL = totalByKey('TDKOL', sortedItems);
  const TDSUM = totalByKey('TDSUM', sortedItems);
  const TKKOL = totalByKey('TKKOL', sortedItems);
  const TKSUM = totalByKey('TKSUM', sortedItems);

  const renderLeafRow = (
    element: any,
    depth: number,
    ancestorsOpen: boolean,
    reactKey: string
  ): JSX.Element => {
    const nameClickable = !element?.isFolder && hasTmzPreviewImages(element);
    const hidden = !ancestorsOpen;
    const leafNum = ancestorsOpen ? ++leafCounterRef.current : null;
    return (
      <tr
        key={reactKey}
        className={hidden ? styles.collapsedHidden : undefined}
      >
        <td className={styles.number}>{leafNum != null ? leafNum : ''}</td>
        <td
          id="itemName"
          className={`${styles.title}${nameClickable ? ` ${styles.titleClickable}` : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => openImagePreview(element)}
        >
          {element?.name}
        </td>
        <td>{element?.article ?? ''}</td>
        <td style={{ textAlign: 'center' }}>{element?.unit || ''}</td>
        <td>{numberValue(element?.POKOL)}</td>
        <td>{numberValue(element?.POSUM)}</td>
        <td
          className={styles.clickableCell}
          onClick={() => openEntries(element, DEBETKREDIT.DEBET)}
        >
          {numberValue(element?.TDKOL)}
        </td>
        <td
          className={styles.clickableCell}
          onClick={() => openEntries(element, DEBETKREDIT.DEBET)}
        >
          {numberValue(element?.TDSUM)}
        </td>
        <td
          className={styles.clickableCell}
          onClick={() => openEntries(element, DEBETKREDIT.KREDIT)}
        >
          {numberValue(element?.TKKOL)}
        </td>
        <td
          className={styles.clickableCell}
          onClick={() => openEntries(element, DEBETKREDIT.KREDIT)}
        >
          {numberValue(element?.TKSUM)}
        </td>
        <td>{numberValue(element?.POKOL + element?.TDKOL - element?.TKKOL)}</td>
        <td>{numberValue(element?.POSUM + element?.TDSUM - element?.TKSUM)}</td>
      </tr>
    );
  };

  const renderGroupHeaderRow = (
    opts: {
      expandKey: string;
      /** id папки в справочнике — сначала показываем #id, затем name */
      folderId: number;
      /** Реквизит name папки (после #id) */
      name: string;
      depth: number;
      ancestorsOpen: boolean;
      metrics: {
        POKOL: number;
        POSUM: number;
        TDKOL: number;
        TDSUM: number;
        TKKOL: number;
        TKSUM: number;
      };
      article?: string;
      unit?: string;
    }
  ): JSX.Element => {
    const isOpen = expanded.has(opts.expandKey);
    const hidden = !opts.ancestorsOpen;
    return (
      <tr
        key={`hdr-${opts.expandKey}`}
        className={`${styles.groupRow} ${hidden ? styles.collapsedHidden : ''}`}
        onClick={() => toggleExpand(opts.expandKey)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand(opts.expandKey);
          }
        }}
        aria-expanded={isOpen}
      >
        <td className={styles.number}>
          <span className={styles.expandGlyph} aria-hidden>
            {isOpen ? '−' : '+'}
          </span>
        </td>
        <td
          className={`${styles.title} ${styles.groupTitle}`}
          style={{ paddingLeft: 10 + opts.depth * 16 }}
          title={`#${opts.folderId}${opts.name?.trim() ? ` ${opts.name.trim()}` : ''}`}
        >
          <span className={styles.groupIdPrefix}>#{opts.folderId}</span>
          {opts.name?.trim() ? (
            <>
              {' '}
              <span className={styles.groupFolderName}>{opts.name.trim()}</span>
            </>
          ) : null}
        </td>
        <td>{opts.article ?? ''}</td>
        <td style={{ textAlign: 'center' }}>{opts.unit ?? ''}</td>
        <td>{numberValue(opts.metrics.POKOL)}</td>
        <td>{numberValue(opts.metrics.POSUM)}</td>
        <td>{numberValue(opts.metrics.TDKOL)}</td>
        <td>{numberValue(opts.metrics.TDSUM)}</td>
        <td>{numberValue(opts.metrics.TKKOL)}</td>
        <td>{numberValue(opts.metrics.TKSUM)}</td>
        <td>{numberValue(opts.metrics.POKOL + opts.metrics.TDKOL - opts.metrics.TKKOL)}</td>
        <td>{numberValue(opts.metrics.POSUM + opts.metrics.TDSUM - opts.metrics.TKSUM)}</td>
      </tr>
    );
  };

  const renderNode = (element: any, depth: number, ancestorsOpen: boolean): ReactNode => {
    const kids = maps.childrenByParent.get(element?.id) ?? [];
    if (!kids.length) {
      return renderLeafRow(element, depth, ancestorsOpen, `leaf-${element?.id}-${depth}`);
    }
    const expandKey = expandKeyNode(element.id);
    const isOpen = expanded.has(expandKey);
    const kidsAncestorsOpen = ancestorsOpen && isOpen;
    const m = {
      POKOL: Number(element?.POKOL) || 0,
      POSUM: Number(element?.POSUM) || 0,
      TDKOL: Number(element?.TDKOL) || 0,
      TDSUM: Number(element?.TDSUM) || 0,
      TKKOL: Number(element?.TKKOL) || 0,
      TKSUM: Number(element?.TKSUM) || 0,
    };
    return (
      <Fragment key={expandKey}>
        {renderGroupHeaderRow({
          expandKey,
          folderId: element.id,
          name: pickName(element?.name),
          depth,
          ancestorsOpen,
          metrics: m,
          article: element?.article ?? '',
          unit: element?.unit || '',
        })}
        {kids.map((child: any) => renderNode(child, depth + 1, kidsAncestorsOpen))}
      </Fragment>
    );
  };

  const renderVirtualTopGroup = (parentId: number, children: any[], ancestorsOpen: boolean): ReactNode => {
    const expandKey = expandKeyVirtual(parentId);
    const isOpen = expanded.has(expandKey);
    const kidsAncestorsOpen = ancestorsOpen && isOpen;
    const groupName = pickName(children[0]?.parentName, resolveParentName(parentId));
    const agg = aggregateMetrics(children);
    return (
      <Fragment key={expandKey}>
        {renderGroupHeaderRow({
          expandKey,
          folderId: parentId,
          name: groupName,
          depth: 0,
          ancestorsOpen,
          metrics: agg,
        })}
        {children.map((child: any) => renderNode(child, 1, kidsAncestorsOpen))}
      </Fragment>
    );
  };

  leafCounterRef.current = 0;

  return (
    <>
      <tbody>
        <tr className={styles.sectionName}>
          <td></td>
          <td>{section}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
      <tbody className={`${styles.tbody} ${styles.matOborotItemBody}`}>
        {sortedItems &&
          sortedItems.length > 0 &&
          topEntriesSorted.map((entry, idx) => {
            if (entry.kind === 'virtual') {
              return renderVirtualTopGroup(entry.parentId, entry.children, true);
            }
            return <Fragment key={`root-${entry.element?.id}-${idx}`}>{renderNode(entry.element, 0, true)}</Fragment>;
          })}
      </tbody>
      <tbody>
        <tr className={styles.total}>
          <td></td>
          <td>Жами</td>
          <td></td>
          <td></td>
          <td className={styles.totalTd}>{numberValue(POKOL)}</td>
          <td className={styles.totalTd}>{numberValue(POSUM)}</td>
          <td className={styles.totalTd}>{numberValue(TDKOL)}</td>
          <td className={styles.totalTd}>{numberValue(TDSUM)}</td>
          <td className={styles.totalTd}>{numberValue(TKKOL)}</td>
          <td className={styles.totalTd}>{numberValue(TKSUM)}</td>
          <td className={styles.totalTd}>{numberValue(POKOL + TDKOL - TKKOL)}</td>
          <td className={styles.totalTd}>{numberValue(POSUM + TDSUM - TKSUM)}</td>
        </tr>
      </tbody>
      <TmzReportImageModal
        isOpen={Boolean(imagePreview)}
        onClose={() => setImagePreview(null)}
        title={imagePreview?.title ?? ''}
        imageSlots={imagePreview?.slots ?? [null, null, null]}
      />
      <MatOborotEntriesModal
        isOpen={entriesModal.open}
        onClose={closeEntriesModal}
        title={entriesModal.title}
        loading={entriesModal.loading}
        entries={entriesModal.entries}
        references={mainData.reference?.allReferences}
        onSelectDocument={handleSelectDocument}
      />
    </>
  );
};
