import { ReferenceModel } from '@/app/interfaces/reference.interface';

/** Id папок-предков по цепочке parentId (для раскрытия пути к строке). */
export function collectAncestorFolderIds(
  itemId: number,
  items: ReferenceModel[],
): number[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const folderIds: number[] = [];
  let current = byId.get(itemId);
  while (current) {
    const parentId =
      current.parentId === null || current.parentId === undefined || current.parentId === 0
        ? null
        : current.parentId;
    if (parentId == null) break;
    const parent = byId.get(parentId);
    if (!parent) break;
    if (parent.isFolder && parent.id != null) {
      folderIds.push(parent.id);
    }
    current = parent;
  }
  return folderIds;
}
