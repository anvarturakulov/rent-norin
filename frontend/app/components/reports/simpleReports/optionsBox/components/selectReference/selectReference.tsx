import { SelectReferenceProps } from './selectReference.props';
import styles from './selectReference.module.css';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import { ReferenceModel, TypeReference, TypeSECTION, TypePartners } from '@/app/interfaces/reference.interface';
import { Maindata } from '@/app/context/app.context.interfaces';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';
import { UserRoles } from '@/app/interfaces/user.interface';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import cn from 'classnames';
import { ReportType, Schet } from '@/app/interfaces/report.interface';
import { shouldSkipOrgFilterInReportSelect } from '@/app/components/reference/helpers/reference.constants';
import { matchTmzNameSearch } from '@/app/components/lists/referencesList/helpers/matchTmzReferenceSearch';

const getTmzOptionLabel = (item: ReferenceModel): string => {
    const name = item.name?.trim() || '';
    const article = item.article?.trim();
    if (article) return `${name} (${article})`;
    return name;
};

const tmzMatchesSearch = (item: ReferenceModel, term: string): boolean => {
    const lower = term.toLowerCase();
    if (item.name?.toLowerCase().includes(lower)) return true;
    if (item.article?.toLowerCase().includes(lower)) return true;
    return false;
};

export const SelectReference = ({ label, visible, typeReference , className, dense, ...props }: SelectReferenceProps): JSX.Element => {
    const {mainData, setMainData} = useAppContext();
    const { user } = mainData.users;
    const { contentName } = mainData.document;
    const { reportOption, selectedEnterpriseId } = mainData.report;
    const token = user?.token;
    const partnerType = reportOption?.partnerType;
    const schet = reportOption?.schet;

    // Для Oborotka S40/S60 partnerType не задаётся — выводим из счёта
    const effectivePartnerType = useMemo(() => {
        if (partnerType) return partnerType;
        if (contentName === ReportType.Oborotka && typeReference === TypeReference.PARTNERS) {
            if (schet === Schet.S40) return 'CLIENTS' as const;
            if (schet === Schet.S60) return 'SUPPLIERS' as const;
        }
        if (contentName === ReportType.MatOborot && typeReference === TypeReference.PARTNERS) {
            if (schet === Schet.S12) return 'CLIENTS' as const;
        }
        return partnerType;
    }, [partnerType, contentName, typeReference, schet]);

    const skipOrgFilter = useMemo(
        () => shouldSkipOrgFilterInReportSelect(typeReference, effectivePartnerType),
        [typeReference, effectivePartnerType],
    );

    // Проверяем, является ли пользователь глобальным
    const isGlobal = useMemo(() => {
        return user?.role && isGlobalRole(user.role);
    }, [user?.role]);

    // superKassir может выбирать организацию в отчёте (как HEADGLOBAL)
    const canUseSelectedEnterprise = useMemo(() => {
        return isGlobal || user?.superKassir === true;
    }, [isGlobal, user?.superKassir]);
    
    // Для глобальных и superKassir используем selectedEnterpriseId из контекста отчетов
    const enterpriseId = useMemo(() => {
        if (canUseSelectedEnterprise) {
            if (typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null) {
                return (selectedEnterpriseId as any)?.id;
            }
            return selectedEnterpriseId;
        }
        return user?.enterpriseId;
    }, [canUseSelectedEnterprise, selectedEnterpriseId, user?.enterpriseId]);
    
    // Проверяем, нужно ли показывать все справочники без фильтрации по организации
    // Это нужно для случая, когда выбран DEPARTMENTS и typeReference === STORAGES
    const shouldShowAllWithoutOrgFilter = useMemo(() => {
        return partnerType === 'DEPARTMENTS' && typeReference === TypeReference.STORAGES;
    }, [partnerType, typeReference]);
    
    // Проверяем, нужно ли загружать STORAGES вместе с PARTNERS для DEPARTMENTS
    const shouldLoadStoragesForDepartments = useMemo(() => {
        return partnerType === 'DEPARTMENTS' && typeReference === TypeReference.PARTNERS;
    }, [partnerType, typeReference]);

    // Состояния для поиска
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState('Танланмаган');
    const [selectedItem, setSelectedItem] = useState<ReferenceModel | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSearchTerm('');
        setIsOpen(false);
    }, [typeReference]);
    
    // Формируем URL для основного типа справочника
    const url = useMemo(() => {
        // ТМЗ в отчётах — полный справочник (как в getReferencesForReport на бэкенде)
        if (typeReference === TypeReference.TMZ) {
            return `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}`;
        }
        if (shouldShowAllWithoutOrgFilter || skipOrgFilter) {
            return `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}`;
        }
        return enterpriseId 
            ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}?enterpriseId=${enterpriseId}`
            : `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${typeReference}`;
    }, [typeReference, enterpriseId, shouldShowAllWithoutOrgFilter, skipOrgFilter]);
    
    // URL для STORAGES, если нужно загружать их для DEPARTMENTS
    const storagesUrl = useMemo(() => {
        if (shouldLoadStoragesForDepartments) {
            // Для DEPARTMENTS не передаем enterpriseId, чтобы получить все справочники
            return `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.STORAGES}`;
        }
        return null;
    }, [shouldLoadStoragesForDepartments]);
    
    const { data, mutate } = useSWR(url, (url) => getDataForSwr(url, token));
    const { data: storagesData } = useSWR(storagesUrl, (url) => getDataForSwr(url, token));
    
    // Объединяем данные: если нужно загружать STORAGES для DEPARTMENTS, объединяем массивы
    const combinedData = useMemo(() => {
        if (shouldLoadStoragesForDepartments && storagesData) {
            return [...(data || []), ...(storagesData || [])];
        }
        return data;
    }, [data, storagesData, shouldLoadStoragesForDepartments]);
    
    // Специальная опция "Барчаси" для DEPARTMENTS
    const allOption = useMemo(() => {
        if (shouldLoadStoragesForDepartments) {
            return {
                id: -1,
                name: 'Барчаси',
                typeReference: TypeReference.STORAGES,
                refValues: {
                    typeSection: TypeSECTION.COMMON
                }
            } as ReferenceModel;
        }
        return null;
    }, [shouldLoadStoragesForDepartments]);
    
    // Фильтрация данных
    const filteredData = useMemo(() => {
        if (!combinedData) return [];
        
        let filtered = combinedData.filter((item: ReferenceModel) => {
            if ( item.refValues?.markToDeleted) return false
            if ( item.isFolder) return false

            if (!shouldLoadStoragesForDepartments && item.typeReference !== typeReference) {
                return false;
            }
            
            // Для DEPARTMENTS + STORAGES показываем только COMMON и не фильтруем по организации
            if (shouldShowAllWithoutOrgFilter) {
                // Проверяем роль GLAVBUX для STORAGES
                if (user?.role == UserRoles.GLAVBUX) return false;
                // Показываем только справочники с sectionType.COMMON
                return item.refValues?.typeSection === TypeSECTION.COMMON;
            }
            
            // Специальная логика для DEPARTMENTS + PARTNERS: показываем PARTNERS с typePartners === DEPARTMENTS и STORAGES с typeSection === COMMON
            if (shouldLoadStoragesForDepartments) {
                if (item.typeReference === TypeReference.PARTNERS) {
                    // Показываем только партнеров с typePartners === DEPARTMENTS
                    return item.refValues?.typePartners === TypePartners.DEPARTMENTS;
                } else if (item.typeReference === TypeReference.STORAGES) {
                    // Проверяем роль GLAVBUX для STORAGES
                    if (user?.role == UserRoles.GLAVBUX) return false;
                    // Показываем только storages с sectionType.COMMON
                    return item.refValues?.typeSection === TypeSECTION.COMMON;
                }
                return false;
            }
            
            // ТМЗ — без фильтра по организации в списке выбора
            if (item.typeReference === TypeReference.TMZ) {
                return true;
            }

            // Фильтр по enterpriseId (общие WORKERS/CHARGES/PARTNERS — без фильтра по org)
            if (!isGlobal && enterpriseId && !skipOrgFilter) {
                if (item.enterpriseId !== enterpriseId) {
                    return false;
                }
            }
            
            // Фильтрация по типу партнера для PARTNERS
            if (item.typeReference == TypeReference.PARTNERS && effectivePartnerType) {
                const typePartnersMap: Record<string, TypePartners> = {
                    'CLIENTS': TypePartners.CLIENTS,
                    'SUPPLIERS': TypePartners.SUPPLIERS,
                    'DEPARTMENTS': TypePartners.DEPARTMENTS
                };
                const expectedTypePartners = typePartnersMap[effectivePartnerType];
                if (expectedTypePartners && item.refValues?.typePartners !== expectedTypePartners) {
                    return false;
                }
            }
            
            if (item.typeReference == TypeReference.STORAGES) {
                if ( user?.role == UserRoles.GLAVBUX) return false
                if (contentName === ReportType.MatOborot) {
                    return (
                        item.refValues?.typeSection == TypeSECTION.COMMON ||
                        item.refValues?.typeSection == TypeSECTION.STORAGE
                    );
                }
                if ( 
                    item.refValues?.typeSection == TypeSECTION.STORAGE ||
                    item.refValues?.typeSection == TypeSECTION.COMMON ||
                    item.refValues?.typeSection == TypeSECTION.BANK ||
                    item.refValues?.typeSection == TypeSECTION.CASH ||
                    item.refValues?.typeSection == TypeSECTION.PLASTIK
                ) return true
                else return false
            }
            return true
        }).sort(sortByName);
        
        if (!searchTerm.trim()) return filtered;
        const term = searchTerm.trim();
        return filtered.filter((item: ReferenceModel) => {
            if (typeReference === TypeReference.TMZ) return tmzMatchesSearch(item, term);
            if (typeReference === TypeReference.PARTNERS) return matchTmzNameSearch(item, term);
            return item.name.toLowerCase().includes(term.toLowerCase());
        });
    }, [combinedData, searchTerm, user?.role, isGlobal, enterpriseId, shouldShowAllWithoutOrgFilter, shouldLoadStoragesForDepartments, skipOrgFilter, effectivePartnerType, contentName, typeReference]);
    
    const changeElements = (id: string | null, setMainData: Function | undefined, mainData: Maindata) => {
        let {reportOption} = mainData.report;
        
        let newObj = {
            ...reportOption,
            [props.id || 'firstReferenceId']: id,
        }
        if (setMainData) {
            setMainData('reportOption', {...newObj})
        }
    }

    // Обработчик выбора опции по умолчанию
    const handleDefaultOptionSelect = useCallback(() => {
        setSelected('Танланмаган');
        setSelectedItem(null);
        setSearchTerm('');
        setIsOpen(false);
        inputRef.current?.blur();
        changeElements(null, setMainData, mainData);
    }, [setMainData, mainData]);

    // Обработчик выбора элемента
    const getItemDisplayLabel = useCallback((item: ReferenceModel) => {
        return typeReference === TypeReference.TMZ ? getTmzOptionLabel(item) : item.name;
    }, [typeReference]);

    const handleItemSelect = useCallback((item: ReferenceModel) => {
        setSelected(getItemDisplayLabel(item));
        setSelectedItem(item);
        setSearchTerm('');
        setIsOpen(false);
        inputRef.current?.blur();
        // Для "Барчаси" передаем -1, иначе обычный ID
        const idToSend = item.id === -1 ? '-1' : (item.id?.toString() || null);
        changeElements(idToSend, setMainData, mainData);
    }, [setMainData, mainData, getItemDisplayLabel]);

    // Обработчик клика вне дропдауна
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                inputRef.current?.blur();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Обработчик клавиш
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredData.length > 0) {
                handleItemSelect(filteredData[0]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
            inputRef.current?.blur();
        }
    }, [filteredData, handleItemSelect]);

    useEffect(() => {
        console.log('data', data)
    }, [data])
    
    // Восстанавливаем выбранное значение при загрузке
    useEffect(() => {
        const fieldId = (props.id || 'firstReferenceId') as keyof typeof reportOption;
        const currentValue = reportOption?.[fieldId];
        
        // Проверяем, является ли значение -1 (для "Барчаси")
        // firstReferenceId имеет тип number | undefined, поэтому проверяем только числовое значение
        if (typeof currentValue === 'number' && currentValue === -1) {
            // Восстанавливаем выбор "Барчаси"
            if (allOption) {
                setSelected(allOption.name);
                setSelectedItem(allOption);
            }
        } else if (currentValue && typeof currentValue === 'number' && combinedData) {
            // Восстанавливаем выбор обычного элемента
            const item = combinedData.find((item: ReferenceModel) => item.id?.toString() === currentValue.toString());
            if (item) {
                setSelected(typeReference === TypeReference.TMZ ? getTmzOptionLabel(item) : item.name);
                setSelectedItem(item);
            }
        }
    }, [reportOption, props.id, combinedData, allOption, typeReference])
    
    if (visible == false) return <></>
    
    return (
        <div className={cn(styles.box, className, { [styles.denseBox]: dense })}>
            {label !='' && <div className={styles.label}>{label}</div>} 
            <div className={styles.customSelectContainer} ref={dropdownRef}>
                <div 
                    className={cn(styles.customSelect, { [styles.dense]: dense })}
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (!isOpen) {
                            setTimeout(() => {
                                inputRef.current?.focus();
                            }, 0);
                        }
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        className={cn(styles.searchInput, {
                            [styles.defaultSelected]: selected === 'Танланмаган'
                        })}
                        placeholder={
                            isOpen && typeReference === TypeReference.PARTNERS
                                ? '+(комбинация), -(ёки), !(йук)...'
                                : (selected || 'Выберите элемент...')
                        }
                        value={isOpen ? searchTerm : selected}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        readOnly={!isOpen}
                    />
                    <div className={styles.arrow}>
                        {isOpen ? '▲' : '▼'}
                    </div>
                </div>
                
                {isOpen && (
                    <div className={styles.dropdown}>
                        <div className={styles.optionsList}>
                            {/* Опция по умолчанию */}
                            <div
                                className={cn(styles.option, styles.defaultOption, {
                                    [styles.selected]: selected === 'Танланмаган'
                                })}
                                onClick={handleDefaultOptionSelect}
                            >
                                {'Танланмаган'}
                            </div>
                            
                            {/* Специальная опция "Барчаси" для DEPARTMENTS */}
                            {allOption && (
                                <div
                                    key={allOption.id}
                                    className={cn(styles.option, {
                                        [styles.selected]: selected === allOption.name
                                    })}
                                    onClick={() => handleItemSelect(allOption)}
                                >
                                    {allOption.name}
                                </div>
                            )}
                            
                            {/* Опции данных */}
                            {filteredData.length === 0 ? (
                                <div className={styles.noResults}>Ничего не найдено</div>
                            ) : (
                                filteredData.map((item: ReferenceModel) => {
                                    const optionLabel = typeReference === TypeReference.TMZ
                                        ? getTmzOptionLabel(item)
                                        : item.name;
                                    return (
                                    <div
                                        key={item.id}
                                        className={cn(styles.option, {
                                            [styles.selected]: selected === optionLabel
                                        })}
                                        onClick={() => handleItemSelect(item)}
                                    >
                                        {optionLabel}
                                    </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
