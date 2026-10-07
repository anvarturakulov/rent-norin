/** Плоский список ТМЗ отчёта matOborot → карта детей и виртуальные группы (родитель вне выборки). */

export type MatOborotChildrenMaps = {
  idSet: Set<number>;
  childrenByParent: Map<number, any[]>;
  virtualChildrenByParent: Map<number, any[]>;
};

export function buildChildrenMaps(sortedItems: any[]): MatOborotChildrenMaps {
  const idSet = new Set<number>();
  for (const el of sortedItems) {
    if (el?.id != null && typeof el.id === 'number') idSet.add(el.id);
  }

  const childrenByParent = new Map<number, any[]>();
  const virtualChildrenByParent = new Map<number, any[]>();

  for (const el of sortedItems) {
    const pid = el?.parentId;
    if (pid == null || pid === undefined) continue;
    const bucket = idSet.has(pid) ? childrenByParent : virtualChildrenByParent;
    if (!bucket.has(pid)) bucket.set(pid, []);
    bucket.get(pid)!.push(el);
  }

  const sortByName = (a: any, b: any) => {
    const nameA = (a?.name ?? '').toLowerCase();
    const nameB = (b?.name ?? '').toLowerCase();
    return nameA.localeCompare(nameB);
  };

  Array.from(childrenByParent.values()).forEach((arr) => arr.sort(sortByName));
  Array.from(virtualChildrenByParent.values()).forEach((arr) => arr.sort(sortByName));

  return { idSet, childrenByParent, virtualChildrenByParent };
}

/** Корневые элементы: только parentId == null | undefined */
export function getRootElements(sortedItems: any[]): any[] {
  return sortedItems.filter((el) => el?.parentId == null || el?.parentId === undefined);
}

export type MatOborotTopEntry =
  | { kind: 'root'; element: any }
  | { kind: 'virtual'; parentId: number; children: any[] };

export function buildTopLevelEntries(
  sortedItems: any[],
  maps: MatOborotChildrenMaps
): MatOborotTopEntry[] {
  const roots = getRootElements(sortedItems);
  const entries: MatOborotTopEntry[] = roots.map((element) => ({ kind: 'root', element }));

  for (const [parentId, children] of Array.from(maps.virtualChildrenByParent.entries())) {
    if (children.length) entries.push({ kind: 'virtual', parentId, children });
  }

  return entries;
}

/** Элементы, не достижимые из корней по childrenByParent (битые ссылки и т.п.) — показать как плоские корни. */
export function getUnreachableElements(
  sortedItems: any[],
  maps: MatOborotChildrenMaps
): any[] {
  const visited = new Set<number>();
  const queue: any[] = [...getRootElements(sortedItems)];

  for (const [, children] of Array.from(maps.virtualChildrenByParent.entries())) {
    for (const c of children) queue.push(c);
  }

  while (queue.length) {
    const el = queue.shift();
    const id = el?.id;
    if (id == null || typeof id !== 'number' || visited.has(id)) continue;
    visited.add(id);
    const kids = maps.childrenByParent.get(id);
    if (kids) for (const k of kids) queue.push(k);
  }

  return sortedItems.filter((el) => {
    const id = el?.id;
    if (id == null || typeof id !== 'number') return false;
    return !visited.has(id);
  });
}

export function aggregateMetrics(rows: any[]) {
  let POKOL = 0;
  let POSUM = 0;
  let TDKOL = 0;
  let TDSUM = 0;
  let TKKOL = 0;
  let TKSUM = 0;
  for (const el of rows) {
    POKOL += Number(el?.POKOL) || 0;
    POSUM += Number(el?.POSUM) || 0;
    TDKOL += Number(el?.TDKOL) || 0;
    TDSUM += Number(el?.TDSUM) || 0;
    TKKOL += Number(el?.TKKOL) || 0;
    TKSUM += Number(el?.TKSUM) || 0;
  }
  return { POKOL, POSUM, TDKOL, TDSUM, TKKOL, TKSUM };
}

export function expandKeyNode(id: number): string {
  return `node:${id}`;
}

export function expandKeyVirtual(parentId: number): string {
  return `virtual:${parentId}`;
}
