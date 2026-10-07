'use client'
import { SelectForReferencesProps } from './selectForReferences.props';
import styles from './selectForReferences.module.css';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import { ReferenceModel, TypeSECTION } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';
import { useMemo } from 'react';

const ROOT_VALUE = '';

export const SelectForReferences = ({
    type,
    label,
    referenceId,
    typeReference,
    currentItemId,
    setClientForSectionId,
    className,
    disabled,
    isNewReference,
    ...props
}: SelectForReferencesProps): JSX.Element => {
    const { mainData } = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const enterpriseId = user?.enterpriseId;
    const url = enterpriseId
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}?enterpriseId=${enterpriseId}`
        : `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}`;
    const { data } = useSWR(url, (url) => getDataForSwr(url, token));

    const folderOptions = useMemo((): ReferenceModel[] => {
        if (!data?.length) return [];
        return (data as ReferenceModel[])
            .filter((item: ReferenceModel) =>
                type === 'clientOwner'
                    ? item.refValues?.typeSection === TypeSECTION.COMMON
                    : item.typeReference === typeReference && item.isFolder === true && item.id !== referenceId
            )
            .sort(sortByName)
            .filter((item: ReferenceModel) => !item.refValues?.markToDeleted);
    }, [data, type, typeReference, referenceId]);

    const selectValue = useMemo(() => {
        if (currentItemId == null || currentItemId === undefined) return ROOT_VALUE;
        if (!data) return String(currentItemId);
        const exists = folderOptions.some((item: ReferenceModel) => item.id == currentItemId);
        return exists ? String(currentItemId) : ROOT_VALUE;
    }, [currentItemId, data, folderOptions]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const raw = e.currentTarget.value;
        const id = raw === ROOT_VALUE ? null : Number(raw);
        const selectedFolder =
            id == null ? null : folderOptions.find((item: ReferenceModel) => item.id === id) ?? null;
        setClientForSectionId(id, selectedFolder);
    };

    return (
        <div className={styles.box}>
            {label !== '' && <div className={styles.label}>{label}</div>}
            <select
                className={cn(styles.select, className)}
                value={selectValue}
                onChange={handleChange}
                disabled={disabled}
                {...props}
            >
                <option value={ROOT_VALUE} className={styles.chooseMe} key={-1}>
                    Бирламчи элемент (папка ичида эмас)
                </option>
                {folderOptions.map((item: ReferenceModel) => (
                    <option className={styles.option} key={item.id} value={String(item.id)}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    );
};
