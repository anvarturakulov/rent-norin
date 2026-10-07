'use client'
import React, { useEffect, useMemo, memo, useState, useRef, useCallback } from 'react';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { ReferencesListProps } from './referencesList.props';
import Header from '../../common/header/header';
import { getTypeReference } from '@/app/service/references/getTypeReference';
import { getReference } from './helpers/references.functions';
import { collectAncestorFolderIds } from './helpers/collectAncestorFolderIds';
import { sortByNameWithDeleted } from '@/app/service/references/sortByName';
import { Reference } from '../../reference/reference';
import { useReferencesData, useAllReferences } from './hooks/useReferencesData';
import { TableHeader } from './components/TableHeader';
import { ReferenceTableRow } from './components/ReferenceTableRow';
import { ReferenceUsageModal } from './components/ReferenceUsageModal';
import { ReferencesListSearch } from './components/ReferencesListSearch';
import { matchTmzCombinedSearch, matchTmzNameSearch } from './helpers/matchTmzReferenceSearch';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import useSWR from 'swr';
import LoadingIco from '@/app/components/common/loading.svg';
import loadingStyles from '@/app/components/common/loading.module.css';
import styles from './referencesList.module.css';
import { canViewReference } from '@/app/utils/referencePermissions';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { showMessage } from '@/app/service/common/showMessage';
import {
    ReferencesService,
    ReferenceUsageResponse,
} from '@/app/service/references/references.service';
import {
    exportBasisAllMaterialsXml,
    exportBasisTestMaterialsXml,
} from '@/app/service/references/exportMaterialsToBasisXml';
import { compareTmzByImageAndType } from './helpers/compareTmzImageSort';

export type TmzImageSortMode = 'none' | 'noImageFirst' | 'hasImageFirst';

// Интерфейс для узла дерева
interface TreeNode {
  item: any;
  children: TreeNode[];
  level: number;
  isOpen: boolean;
}

/** Порядок DFS с учётом раскрытых папок — порядок строк таблицы */
function flattenVisibleTree(nodes: TreeNode[], openFolders: Set<number>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.item.isFolder && openFolders.has(node.item.id) && node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return out;
}

const ReferencesList = memo<ReferencesListProps>(({className, ...props}): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const { showReferenceWindow, selectedEnterpriseId } = mainData.reference;
    const { contentName } = mainData.document;
    const { user } = mainData.users;
    const { updateDataForRefenceJournal } = mainData.journal;
    const referenceType = getTypeReference(contentName);
    const token = user?.token;

    const [openFolders, setOpenFolders] = useState<Set<number>>(new Set());
    const [articleSearchQuery, setArticleSearchQuery] = useState('');
    const [nameSearchQuery, setNameSearchQuery] = useState('');
    const [shortNameFilterId, setShortNameFilterId] = useState<number | null>(null);
    const [sizeFilterId, setSizeFilterId] = useState<number | null>(null);
    const [colorFilterId, setColorFilterId] = useState<number | null>(null);
    const [manufactureFilterId, setManufactureFilterId] = useState<number | null>(null);
    const [lastActiveReferenceId, setLastActiveReferenceId] = useState<number | null>(null);
    const [imageSort, setImageSort] = useState<TmzImageSortMode>('none');
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const prevShowReferenceWindowRef = useRef(showReferenceWindow);

    const isValidReferenceType = referenceType && referenceType.trim() !== '';
    const canViewList = isValidReferenceType
        ? canViewReference(user, referenceType as TypeReference)
        : true;
    
    const { data, mutate, isLoading: isLoadingData } = useReferencesData(referenceType, token, selectedEnterpriseId);
    const { data: references, isLoading: isLoadingReferences } = useAllReferences(token);
    const { data: enterprises } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );

    useEffect(() => {
        if (isValidReferenceType && token && updateDataForRefenceJournal) {
            mutate();
            setMainData && setMainData('updateDataForRefenceJournal', false);
        }
    }, [updateDataForRefenceJournal, selectedEnterpriseId]);

    useEffect(() => {
        setOpenFolders(new Set());
        setArticleSearchQuery('');
        setNameSearchQuery('');
        setShortNameFilterId(null);
        setSizeFilterId(null);
        setColorFilterId(null);
        setManufactureFilterId(null);
        setLastActiveReferenceId(null);
        setImageSort('none');
    }, [referenceType, selectedEnterpriseId]);

    const buildTree = (items: any[]): TreeNode[] => {
        if (!items || items.length === 0) return [];
        
        const itemMap = new Map<number, TreeNode>();
        const childrenByParentId = new Map<number | null, TreeNode[]>();
        const roots: TreeNode[] = [];

        items.forEach(item => {
            const node: TreeNode = {
                item,
                children: [],
                level: 0,
                isOpen: false
            };
            itemMap.set(item.id, node);
            
            const parentId = item.parentId === null || item.parentId === undefined || item.parentId === 0 ? null : item.parentId;
            
            if (!childrenByParentId.has(parentId)) {
                childrenByParentId.set(parentId, []);
            }
            childrenByParentId.get(parentId)!.push(node);
        });

        const setLevelsAndChildren = (node: TreeNode, level: number) => {
            node.level = level;
            const children = childrenByParentId.get(node.item.id) || [];
            node.children = children;
            
            children.forEach(child => {
                setLevelsAndChildren(child, level + 1);
            });
        };

        const rootNodes = childrenByParentId.get(null) || [];
        rootNodes.forEach(rootNode => {
            setLevelsAndChildren(rootNode, 0);
            roots.push(rootNode);
        });

        const sortTree = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.sort((a, b) => {
                if (a.item.isFolder && !b.item.isFolder) return -1;
                if (!a.item.isFolder && b.item.isFolder) return 1;
                return a.item.name.localeCompare(b.item.name);
            }).map(node => {
                if (node.children.length > 0) {
                    node.children = sortTree(node.children);
                }
                return node;
            });
        };

        return sortTree(roots);
    };

    const toggleFolder = (folderId: number) => {
        setOpenFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const isTMZList = referenceType === TypeReference.TMZ;

    const sortedData = useMemo(() => {
        if (!data || !Array.isArray(data) || data.length === 0) return [];
        
        const filteredData = data.filter(item => {
            return item.typeReference === referenceType;
        });
        
        return filteredData.sort(sortByNameWithDeleted);
    }, [data, referenceType]);

    const treeData = useMemo(() => {
        return buildTree(sortedData);
    }, [sortedData]);

    const isNameSearchActive = nameSearchQuery.trim().length > 0;
    const isTmzArticleSearchActive = isTMZList && articleSearchQuery.trim().length > 0;
    const isTmzDictionaryFilterActive = isTMZList && (
        shortNameFilterId !== null ||
        sizeFilterId !== null ||
        colorFilterId !== null ||
        manufactureFilterId !== null
    );
    const isFilterActive = isNameSearchActive || isTmzArticleSearchActive || isTmzDictionaryFilterActive;
    const isImageSortActive = isTMZList && imageSort !== 'none';

    const searchResults = useMemo(() => {
        if (!isFilterActive) return [];
        return sortedData
            .filter((item) => {
                if (item.isFolder) return false;
                if (isTMZList) {
                    if ((isNameSearchActive || isTmzArticleSearchActive) && !matchTmzCombinedSearch(item, articleSearchQuery, nameSearchQuery)) {
                        return false;
                    }
                    if (shortNameFilterId !== null && item.refValues?.shortNameId !== shortNameFilterId) {
                        return false;
                    }
                    if (sizeFilterId !== null && item.refValues?.sizeId !== sizeFilterId) {
                        return false;
                    }
                    if (colorFilterId !== null && item.refValues?.colorId !== colorFilterId) {
                        return false;
                    }
                    if (manufactureFilterId !== null && item.refValues?.manufactureId !== manufactureFilterId) {
                        return false;
                    }
                    return true;
                }
                if (isNameSearchActive && !matchTmzNameSearch(item, nameSearchQuery)) {
                    return false;
                }
                return true;
            })
            .sort(sortByNameWithDeleted);
    }, [
        isFilterActive,
        isNameSearchActive,
        isTmzArticleSearchActive,
        articleSearchQuery,
        nameSearchQuery,
        shortNameFilterId,
        sizeFilterId,
        colorFilterId,
        manufactureFilterId,
        isTMZList,
        sortedData,
    ]);

    const imageSortedRows = useMemo(() => {
        if (!isImageSortActive) return [];
        const base = isFilterActive
            ? searchResults
            : sortedData.filter((item) => !item.isFolder);
        return [...base].sort((a, b) =>
            compareTmzByImageAndType(a, b, imageSort),
        );
    }, [isImageSortActive, isFilterActive, searchResults, sortedData, imageSort]);

    const visibleRows = useMemo(() => {
        if (isImageSortActive) {
            return imageSortedRows.map((item) => ({
                item,
                children: [] as TreeNode[],
                level: 0,
                isOpen: false,
            }));
        }
        if (isFilterActive) {
            return searchResults.map((item) => ({
                item,
                children: [] as TreeNode[],
                level: 0,
                isOpen: false,
            }));
        }
        return flattenVisibleTree(treeData, openFolders);
    }, [isImageSortActive, imageSortedRows, isFilterActive, searchResults, treeData, openFolders]);

    const expandAncestorsForItem = useCallback((itemId: number) => {
        const folderIds = collectAncestorFolderIds(itemId, sortedData);
        if (folderIds.length === 0) return;
        setOpenFolders((prev) => {
            const next = new Set(prev);
            folderIds.forEach((id) => next.add(id));
            return next;
        });
    }, [sortedData]);

    const handleOpenForEdit = useCallback((itemId: number) => {
        setLastActiveReferenceId(itemId);
        expandAncestorsForItem(itemId);
    }, [expandAncestorsForItem]);

    const handleArticleSearchChange = useCallback((value: string) => {
        setArticleSearchQuery(value);
    }, []);

    const handleNameSearchChange = useCallback((value: string) => {
        setNameSearchQuery(value);
    }, []);

    const handleShortNameFilterChange = useCallback((id: number | null) => {
        setShortNameFilterId(id);
    }, []);

    const handleSizeFilterChange = useCallback((id: number | null) => {
        setSizeFilterId(id);
    }, []);

    const handleColorFilterChange = useCallback((id: number | null) => {
        setColorFilterId(id);
    }, []);

    const handleManufactureFilterChange = useCallback((id: number | null) => {
        setManufactureFilterId(id);
    }, []);

    const handleToggleImageSort = useCallback(() => {
        if (!isTMZList) return;
        setImageSort((prev) => {
            if (prev === 'none') return 'noImageFirst';
            if (prev === 'noImageFirst') return 'hasImageFirst';
            return 'none';
        });
    }, [isTMZList]);

    const handleExportBasisTest = useCallback(() => {
        const count = exportBasisTestMaterialsXml(sortedData as ReferenceModel[]);
        if (count === 0) {
            showMessage('Нет материалов для экспорта (typeTMZ=MATERIAL с артикулом)', 'warm', setMainData);
            return;
        }
        showMessage(
            `Скачан basis-materials-test.xml (${count} материал${count === 1 ? '' : 'а'} из справочника)`,
            'success',
            setMainData,
        );
    }, [sortedData, setMainData]);

    const handleExportBasisAll = useCallback(() => {
        const count = exportBasisAllMaterialsXml(sortedData as ReferenceModel[]);
        if (count === 0) {
            showMessage('Нет материалов для экспорта (typeTMZ=MATERIAL с артикулом)', 'warm', setMainData);
            return;
        }
        showMessage(`Экспортировано материалов: ${count}`, 'success', setMainData);
    }, [sortedData, setMainData]);

    const [usageModal, setUsageModal] = useState<{
        itemName: string;
        usage: ReferenceUsageResponse;
    } | null>(null);

    const handleFindUsage = useCallback(async (item: ReferenceModel) => {
        if (!token || !item.id) return;
        try {
            const usage = await ReferencesService.getReferenceUsage(item.id, token);
            if (usage.counts.total === 0) {
                showMessage(`"${item.name}" учун боғланишлар топилмади`, 'success', setMainData);
                return;
            }
            setUsageModal({ itemName: item.name, usage });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Боғланишларни қидиришда хатолик';
            showMessage(message, 'error', setMainData);
        }
    }, [token, setMainData]);

    const handleDeletePermanent = useCallback(async (item: ReferenceModel) => {
        if (!token || !item.id) return;
        const confirmed = window.confirm(`"${item.name}" ни базадан тўлиқ ўчиришни тасдиқлайсизми?\nТўлиқ ўчириш фақат боғланишлар бўлмаганда амалга оширилади.`);
        if (!confirmed) return;
        try {
            const usage = await ReferencesService.getReferenceUsage(item.id, token);
            if (!usage.canDelete) {
                showMessage(
                    `"${item.name}" ни ўчириб бўлмайди: боғланишлар мавжуд (${usage.counts.total})`,
                    'error',
                    setMainData,
                );
                return;
            }
            await ReferencesService.deleteReferencePermanent(item.id, token);
            showMessage(`"${item.name}" базадан тўлиқ ўчирилди`, 'success', setMainData);
            await mutate();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Справочникни ўчиришда хатолик';
            showMessage(message, 'error', setMainData);
        }
    }, [token, mutate, setMainData]);

    const handleMarkToDelete = useCallback(async (item: ReferenceModel) => {
        if (!token || !item.id) return;
        try {
            await ReferencesService.markToDelete(item.id, token);
            showMessage(`"${item.name}" ўчиришга белгиланди`, 'success', setMainData);
            await mutate();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Справочникни ўчиришга белгилашда хатолик';
            showMessage(message, 'error', setMainData);
        }
    }, [token, mutate, setMainData]);

    const handleDuplicate = useCallback(async (item: ReferenceModel) => {
        if (!token || !item.id) return;
        try {
            await ReferencesService.duplicateReference(item.id, token);
            showMessage(`"${item.name}" нусхаси яратилди`, 'success', setMainData);
            await mutate();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Справочникни нусхалашда хатолик';
            showMessage(message, 'error', setMainData);
        }
    }, [token, mutate, setMainData]);

    useEffect(() => {
        const wasOpen = prevShowReferenceWindowRef.current;
        prevShowReferenceWindowRef.current = showReferenceWindow;

        if (wasOpen && !showReferenceWindow && lastActiveReferenceId != null) {
            requestAnimationFrame(() => {
                const tbody = tbodyRef.current;
                if (!tbody) return;
                const row = tbody.querySelector<HTMLTableRowElement>(
                    `tr[data-reference-id="${lastActiveReferenceId}"]`,
                );
                row?.scrollIntoView({ block: 'nearest' });
            });
        }
    }, [showReferenceWindow, lastActiveReferenceId]);

    return (
        <>  
            <Header windowFor='reference' />
            <div className={styles.newElement}>
                <Reference mutate={mutate}/>
            </div>

            <div
                className={cn(styles.container, {
                    [styles.listHiddenWhileEditing]: showReferenceWindow,
                })}
            >
                {!canViewList ? (
                    <p style={{ padding: '24px', color: '#b91c1c' }}>
                        Ушбу справочникни кўриш учун рухсатингиз йўқ.
                    </p>
                ) : (!isValidReferenceType || isLoadingData || isLoadingReferences) ? (
                    <LoadingIco className={loadingStyles.loadingIco} />
                ) : (
                    <>
                    <ReferencesListSearch
                        isTMZList={isTMZList}
                        articleValue={articleSearchQuery}
                        nameValue={nameSearchQuery}
                        shortNameFilterId={shortNameFilterId}
                        sizeFilterId={sizeFilterId}
                        colorFilterId={colorFilterId}
                        manufactureFilterId={manufactureFilterId}
                        onArticleChange={handleArticleSearchChange}
                        onNameChange={handleNameSearchChange}
                        onShortNameFilterChange={handleShortNameFilterChange}
                        onSizeFilterChange={handleSizeFilterChange}
                        onColorFilterChange={handleColorFilterChange}
                        onManufactureFilterChange={handleManufactureFilterChange}
                        referenceEnterpriseId={selectedEnterpriseId}
                        resultCount={isFilterActive ? searchResults.length : undefined}
                    />
                    {/* {isTMZList && (
                        <div className={styles.exportToolbar}>
                            <button
                                type="button"
                                className={styles.exportBtn}
                                onClick={handleExportBasisTest}
                            >
                                Экспорт в БАЗИС (тест, 2 шт.)
                            </button>
                            <button
                                type="button"
                                className={styles.exportBtn}
                                onClick={handleExportBasisAll}
                            >
                                Экспорт в БАЗИС (все материалы)
                            </button>
                        </div>
                    )} */}
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <TableHeader
                                referenceType={referenceType}
                                imageSort={imageSort}
                                onToggleImageSort={handleToggleImageSort}
                            />
                        </thead>
                        <tbody ref={tbodyRef} className={styles.tbody}>
                            {(isFilterActive || isImageSortActive) && visibleRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={20}
                                        className={styles.searchEmpty}
                                    >
                                        {isTMZList ? 'Товарлар топилмади' : 'Маълумот топилмади'}
                                    </td>
                                </tr>
                            ) : (
                                visibleRows.map((node) => {
                                    const isFolder = node.item.isFolder;
                                    const isOpen = openFolders.has(node.item.id);
                                    const hasChildren = node.children.length > 0;
                                    return (
                                        <ReferenceTableRow
                                            key={node.item.id}
                                            item={node.item}
                                            referenceType={referenceType}
                                            references={references}
                                            token={token}
                                            setMainData={setMainData}
                                            getReference={getReference}
                                            className={className}
                                            level={node.level}
                                            isFolder={isFolder}
                                            hasChildren={hasChildren}
                                            isOpen={isOpen}
                                            onToggleFolder={() => toggleFolder(node.item.id)}
                                            enterprises={enterprises}
                                            isLastActive={lastActiveReferenceId === node.item.id}
                                            onOpenForEdit={() => handleOpenForEdit(node.item.id)}
                                            onFindUsage={handleFindUsage}
                                            onMarkToDelete={handleMarkToDelete}
                                            onDeletePermanent={handleDeletePermanent}
                                            onDuplicate={handleDuplicate}
                                        />
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    </>
                )}
            </div>

            <ReferenceUsageModal
                open={usageModal != null}
                itemName={usageModal?.itemName ?? ''}
                usage={usageModal?.usage ?? null}
                onClose={() => setUsageModal(null)}
            />
        </>
    );
});

ReferencesList.displayName = 'ReferencesList';

export default ReferencesList;
