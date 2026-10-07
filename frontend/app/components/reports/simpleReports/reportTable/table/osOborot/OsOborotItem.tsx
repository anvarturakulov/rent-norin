'use client';

import { useCallback, useMemo, useRef, useState, Fragment, type ReactNode } from 'react';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { TypeReference, type ReferenceModel } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { totalByKey } from '@/app/components/reports/dashboardReports/utils/calculations';
import {
  buildChildrenMaps,
  buildTopLevelEntries,
  expandKeyNode,
  expandKeyVirtual,
  getUnreachableElements,
  type MatOborotTopEntry,
} from '../matOborot/matOborotItem/matOborotTree';
import { formatCell, pickName } from './osOborot.helpers';
import {
  aggregateOsMetrics,
  metricsFromRow,
  OS_METRIC_KEYS,
  type OsOborotMetrics,
} from './osOborotMetrics';
import { OsOborotItemProps } from './OsOborotItem.props';
import styles from './osOborot.module.css';

function topEntrySortKey(
  entry: MatOborotTopEntry,
  resolveParentName: (id: number) => string,
): string {
  if (entry.kind === 'virtual') {
    const n = pickName(entry.children[0]?.parentName, resolveParentName(entry.parentId));
    if (n) return n.toLowerCase();
    return `\uffff${entry.parentId}`;
  }
  return pickName(entry.element?.name).toLowerCase();
}

function MetricCells({
  m,
  cellClass,
}: {
  m: OsOborotMetrics;
  cellClass?: string;
}) {
  const cls = cellClass ?? styles.amountCol;
  return (
    <>
      {OS_METRIC_KEYS.map((key) => (
        <td key={key} className={cls}>
          {formatCell(m[key])}
        </td>
      ))}
    </>
  );
}

export const OsOborotItem = ({ items }: OsOborotItemProps): JSX.Element => {
  const { mainData } = useAppContext();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const leafCounterRef = useRef(0);

  const token = mainData.users?.user?.token;
  const refsUrl = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/all/';
  const { data: swrReferences } = useSWR(
    token ? refsUrl : null,
    (url: string) => getDataForSwr(url, token),
  );

  const referenceList = useMemo(() => {
    const fromContext = mainData.reference?.allReferences;
    if (fromContext?.length) return fromContext;
    if (Array.isArray(swrReferences)) return swrReferences as ReferenceModel[];
    return [];
  }, [mainData.reference?.allReferences, swrReferences]);

  const resolveParentName = useCallback(
    (id: number) => {
      if (!referenceList.length) return '';
      const byTmz = referenceList.find(
        (x: ReferenceModel) => x.id === id && x.typeReference === TypeReference.TMZ,
      );
      if (byTmz?.name?.trim()) return byTmz.name.trim();
      const anyRef = referenceList.find((x: ReferenceModel) => x.id === id);
      return anyRef?.name?.trim() ?? '';
    },
    [referenceList],
  );

  const sortedItems = items?.length
    ? [...items].sort((a, b) =>
        (a?.name ?? '').toLowerCase().localeCompare((b?.name ?? '').toLowerCase()),
      )
    : [];

  const maps = useMemo(() => buildChildrenMaps(sortedItems), [sortedItems]);

  const topEntriesSorted = useMemo(() => {
    const base = buildTopLevelEntries(sortedItems, maps);
    const unreachable = getUnreachableElements(sortedItems, maps);
    const extra: MatOborotTopEntry[] = unreachable.map((element) => ({
      kind: 'root',
      element,
    }));
    const merged = [...base, ...extra];
    return merged.sort((a, b) =>
      topEntrySortKey(a, resolveParentName).localeCompare(
        topEntrySortKey(b, resolveParentName),
      ),
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

  const renderLeafRow = (
    element: any,
    depth: number,
    ancestorsOpen: boolean,
    reactKey: string,
  ): JSX.Element => {
    const hidden = !ancestorsOpen;
    const leafNum = ancestorsOpen ? ++leafCounterRef.current : null;
    const m = metricsFromRow(element);
    return (
      <tr
        key={reactKey}
        className={`${styles.leafRow} ${hidden ? styles.collapsedHidden : ''}`}
      >
        <td className={styles.number}>{leafNum != null ? leafNum : ''}</td>
        <td className={styles.title} style={{ paddingLeft: 10 + depth * 16 }}>
          {element?.name}
        </td>
        <td className={styles.articleCol}>{element?.article ?? ''}</td>
        <MetricCells m={m} />
      </tr>
    );
  };

  const renderGroupHeaderRow = (opts: {
    expandKey: string;
    folderId: number;
    name: string;
    depth: number;
    ancestorsOpen: boolean;
    metrics: OsOborotMetrics;
    article?: string;
  }): JSX.Element => {
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
        <td className={styles.articleCol}>{opts.article ?? ''}</td>
        <MetricCells m={opts.metrics} />
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
    return (
      <Fragment key={expandKey}>
        {renderGroupHeaderRow({
          expandKey,
          folderId: element.id,
          name: pickName(element?.name, resolveParentName(element.id)),
          depth,
          ancestorsOpen,
          metrics: metricsFromRow(element),
          article: element?.article ?? '',
        })}
        {kids.map((child: any) => renderNode(child, depth + 1, kidsAncestorsOpen))}
      </Fragment>
    );
  };

  const renderVirtualTopGroup = (
    parentId: number,
    children: any[],
    ancestorsOpen: boolean,
  ): ReactNode => {
    const expandKey = expandKeyVirtual(parentId);
    const isOpen = expanded.has(expandKey);
    const kidsAncestorsOpen = ancestorsOpen && isOpen;
    const groupName = pickName(children[0]?.parentName, resolveParentName(parentId));
    return (
      <Fragment key={expandKey}>
        {renderGroupHeaderRow({
          expandKey,
          folderId: parentId,
          name: groupName,
          depth: 0,
          ancestorsOpen,
          metrics: aggregateOsMetrics(children),
        })}
        {children.map((child: any) => renderNode(child, 1, kidsAncestorsOpen))}
      </Fragment>
    );
  };

  leafCounterRef.current = 0;

  const footerTotals = useMemo(() => {
    const t: OsOborotMetrics = {
      POS01: 0,
      POS02: 0,
      residualStart: 0,
      TDS01: 0,
      TKS02: 0,
      TKS01: 0,
      TDS02: 0,
      KOS01: 0,
      KOS02: 0,
      residualEnd: 0,
    };
    for (const key of OS_METRIC_KEYS) {
      t[key] = totalByKey(key, sortedItems);
    }
    return t;
  }, [sortedItems]);

  return (
    <>
      <tbody className={styles.tbody}>
        {sortedItems.length > 0 &&
          topEntriesSorted.map((entry, idx) => {
            if (entry.kind === 'virtual') {
              return renderVirtualTopGroup(entry.parentId, entry.children, true);
            }
            return (
              <Fragment key={`root-${entry.element?.id}-${idx}`}>
                {renderNode(entry.element, 0, true)}
              </Fragment>
            );
          })}
      </tbody>
      <tfoot>
        <tr className={styles.footerRow}>
          <td colSpan={3} className={styles.footerLabel}>
            Жами
          </td>
          <MetricCells m={footerTotals} cellClass={styles.footerAmount} />
        </tr>
      </tfoot>
    </>
  );
};
