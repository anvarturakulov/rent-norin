'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { TypeReference, TypeTMZ, type ReferenceModel } from '@/app/interfaces/reference.interface';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { useAppContext } from '@/app/context/app.context';
import styles from '../clientContractForm/clientContractForm.module.css';

interface Props {
    typeReference: TypeReference;
    typeTMZ?: TypeTMZ;
    value: number;
    name?: string;
    onChange: (id: number, name: string) => void;
    disabled?: boolean;
}

export default function ContractAnaliticSelect({
    typeReference,
    typeTMZ,
    value,
    name,
    onChange,
    disabled,
}: Props) {
    const { mainData } = useAppContext();
    const token = mainData.users.user?.token;
    const enterpriseId = mainData.users.user?.enterpriseId;
    const url =
        token && typeReference
            ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}${
                  enterpriseId != null ? `?enterpriseId=${enterpriseId}` : ''
              }`
            : null;
    const { data } = useSWR(url, (u) => getDataForSwr(u, token));
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);

    const options = useMemo(() => {
        const list = (Array.isArray(data) ? data : []) as ReferenceModel[];
        return list.filter((r) => {
            if (r.isFolder) return false;
            if (typeTMZ && r.refValues?.typeTMZ !== typeTMZ) return false;
            return true;
        });
    }, [data, typeTMZ]);

    const filtered = useMemo(() => {
        if (!search.trim()) return options.slice(0, 80);
        return options.filter((r) => matchTmzNameSearch(r, search)).slice(0, 80);
    }, [options, search]);

    const selectedName =
        name ||
        options.find((r) => Number(r.id) === Number(value))?.name ||
        (value ? `#${value}` : '');

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div ref={boxRef} className={styles.analiticSelect}>
            <button
                type="button"
                className={styles.analiticSelectBtn}
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
            >
                {value ? selectedName : 'Танланг…'}
            </button>
            {open && (
                <div className={styles.analiticDropdown}>
                    <input
                        className={styles.input}
                        autoFocus
                        placeholder="Қидириш…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className={styles.analiticList}>
                        {filtered.length === 0 && (
                            <div className={styles.analiticEmpty}>Топилмади</div>
                        )}
                        {filtered.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                className={styles.analiticOption}
                                onClick={() => {
                                    onChange(Number(r.id), r.name);
                                    setOpen(false);
                                    setSearch('');
                                }}
                            >
                                {r.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
