'use client';

import { useEffect, useMemo, useState } from 'react';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import { TypeReference, type ReferenceModel } from '@/app/interfaces/reference.interface';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { useAppContext } from '@/app/context/app.context';
import cellStyles from '../contractTmzCatalogPicker/contractTmzCatalogPicker.module.css';
import dialogStyles from '../contractOrderPickerModal/contractOrderPickerModal.module.css';
import styles from './contractServiceCatalogPicker.module.css';

interface TreeNode {
    item: ReferenceModel;
    children: TreeNode[];
    level: number;
}

function buildTree(items: ReferenceModel[]): TreeNode[] {
    const childrenByParent = new Map<number | null, TreeNode[]>();
    for (const item of items) {
        const parentId =
            item.parentId == null || Number(item.parentId) === 0
                ? null
                : Number(item.parentId);
        const node: TreeNode = { item, children: [], level: 0 };
        const list = childrenByParent.get(parentId) ?? [];
        list.push(node);
        childrenByParent.set(parentId, list);
    }
    const assign = (nodes: TreeNode[], level: number): TreeNode[] =>
        nodes
            .map((node) => {
                const children = childrenByParent.get(Number(node.item.id)) ?? [];
                return {
                    ...node,
                    level,
                    children: assign(children, level + 1),
                };
            })
            .sort((a, b) => {
                if (a.item.isFolder && !b.item.isFolder) return -1;
                if (!a.item.isFolder && b.item.isFolder) return 1;
                return (a.item.name || '').localeCompare(b.item.name || '', 'ru');
            });
    return assign(childrenByParent.get(null) ?? [], 0);
}

function flattenTree(nodes: TreeNode[], openFolders: Set<number>): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (list: TreeNode[]) => {
        for (const node of list) {
            out.push(node);
            if (
                node.item.isFolder &&
                node.item.id != null &&
                openFolders.has(Number(node.item.id))
            ) {
                walk(node.children);
            }
        }
    };
    walk(nodes);
    return out;
}

interface Props {
    displayName: string;
    hasSelection: boolean;
    onPick: (id: number, name: string) => void;
    onClear?: () => void;
}

export default function ContractServiceCatalogPicker({
    displayName,
    hasSelection,
    onPick,
    onClear,
}: Props) {
    const { mainData } = useAppContext();
    const token = mainData.users.user?.token;
    const url = token
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.SERVICES}`
        : null;
    const { data } = useSWR(url, (u) => getDataForSwr(u, token));
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [openFolders, setOpenFolders] = useState<Set<number>>(new Set());

    const list = useMemo(
        () =>
            ((Array.isArray(data) ? data : []) as ReferenceModel[]).filter(
                (r) => r.typeReference === TypeReference.SERVICES,
            ),
        [data],
    );

    useEffect(() => {
        const ids = list
            .filter((r) => r.isFolder && r.id != null)
            .map((r) => Number(r.id));
        setOpenFolders(new Set(ids));
    }, [list]);

    const tree = useMemo(() => buildTree(list), [list]);

    const rows = useMemo(() => {
        const term = search.trim();
        if (term) {
            return list
                .filter((r) => !r.isFolder && matchTmzNameSearch(r, term))
                .map((item) => ({ item, children: [], level: 0 }));
        }
        return flattenTree(tree, openFolders);
    }, [list, tree, search, openFolders]);

    const readoutClasses = [
        cellStyles.readout,
        hasSelection ? cellStyles.readoutSelected : '',
        cellStyles.readoutClickable,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            <div className={cellStyles.row}>
                <div
                    role="button"
                    tabIndex={0}
                    className={readoutClasses}
                    onClick={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpen(true);
                        }
                    }}
                    title="Справочникдан танлаш"
                >
                    {hasSelection ? displayName : '— справочникдан танланг —'}
                </div>
                {hasSelection && onClear ? (
                    <button
                        type="button"
                        className={cellStyles.clearBtn}
                        onClick={onClear}
                        title="Танловни тозалаш"
                    >
                        <XMarkIcon className={cellStyles.clearBtnIcon} aria-hidden />
                    </button>
                ) : null}
                <button
                    type="button"
                    className={cellStyles.catalogBtn}
                    onClick={() => setOpen(true)}
                    title="Справочникни очиш"
                    aria-label="Справочникни очиш"
                >
                    <Squares2X2Icon className={cellStyles.catalogBtnIcon} aria-hidden />
                </button>
            </div>
            {open && (
                <div
                    className={dialogStyles.overlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setOpen(false);
                    }}
                >
                    <div
                        className={dialogStyles.dialog}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={dialogStyles.title}>Хизмат турини танланг</h3>
                        <div className={dialogStyles.body}>
                            <input
                                className={styles.search}
                                autoFocus
                                placeholder="Қидириш…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <p className={styles.hint}>
                                Папкани очинг ва хизмат турини танланг
                            </p>
                            {rows.length === 0 ? (
                                <div className={dialogStyles.empty}>Топилмади</div>
                            ) : (
                                <table className={dialogStyles.table}>
                                    <thead>
                                        <tr>
                                            <th>Номи</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((node) => {
                                            const id = Number(node.item.id);
                                            const isFolder = Boolean(node.item.isFolder);
                                            return (
                                                <tr
                                                    key={id}
                                                    className={
                                                        isFolder ? styles.folder : styles.item
                                                    }
                                                    onClick={() => {
                                                        if (isFolder) {
                                                            setOpenFolders((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(id)) next.delete(id);
                                                                else next.add(id);
                                                                return next;
                                                            });
                                                            return;
                                                        }
                                                        onPick(id, node.item.name);
                                                        setOpen(false);
                                                        setSearch('');
                                                    }}
                                                >
                                                <td style={{ paddingLeft: 8 + node.level * 16 }}>
                                                    {isFolder ? '📁 ' : ''}
                                                    {node.item.name}
                                                </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className={dialogStyles.footer}>
                            <span className={dialogStyles.footerEnd}>
                                <button
                                    type="button"
                                    className={dialogStyles.btn}
                                    onClick={() => setOpen(false)}
                                >
                                    Ёпиш
                                </button>
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
