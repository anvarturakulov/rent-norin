import React, { memo, useCallback } from 'react';
import { TypeReference } from '@/app/interfaces/reference.interface';
import { TmzDictionarySelect } from '@/app/components/reference/tmzDictionarySelect/tmzDictionarySelect';
import styles from '../referencesList.module.css';

interface ReferencesListSearchProps {
  isTMZList: boolean;
  articleValue: string;
  nameValue: string;
  shortNameFilterId: number | null;
  sizeFilterId: number | null;
  colorFilterId: number | null;
  manufactureFilterId: number | null;
  onArticleChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onShortNameFilterChange: (id: number | null) => void;
  onSizeFilterChange: (id: number | null) => void;
  onColorFilterChange: (id: number | null) => void;
  onManufactureFilterChange: (id: number | null) => void;
  referenceEnterpriseId?: number | null;
  resultCount?: number;
}

export const ReferencesListSearch = memo<ReferencesListSearchProps>(({
  isTMZList,
  articleValue,
  nameValue,
  shortNameFilterId,
  sizeFilterId,
  colorFilterId,
  manufactureFilterId,
  onArticleChange,
  onNameChange,
  onShortNameFilterChange,
  onSizeFilterChange,
  onColorFilterChange,
  onManufactureFilterChange,
  referenceEnterpriseId,
  resultCount,
}) => {
  const handleArticleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onArticleChange(e.target.value);
  }, [onArticleChange]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onNameChange(e.target.value);
  }, [onNameChange]);

  const hasQuery = nameValue.trim().length > 0 || (isTMZList && articleValue.trim().length > 0);

  return (
    <div className={styles.searchToolbar}>
      <div className={styles.searchInputRow}>
        {isTMZList && (
          <input
            type="text"
            placeholder="Артикул..."
            value={articleValue}
            onChange={handleArticleChange}
            className={`${styles.searchInput} ${styles.searchInputArticle}`}
            autoComplete="off"
          />
        )}
        <input
          type="text"
          placeholder="Номи бўйича излаш (+(комбинация), -(ёки), !(йук))..."
          value={nameValue}
          onChange={handleNameChange}
          className={`${styles.searchInput} ${styles.searchInputName}`}
          autoComplete="off"
        />
        {hasQuery && resultCount != null && resultCount > 0 && (
          <span className={styles.searchMeta}>Топилди: {resultCount}</span>
        )}
      </div>
      {isTMZList && (
        <div className={styles.dictionaryFilterRow}>
          <TmzDictionarySelect
            attrField="shortName"
            dictionaryType={TypeReference.TMZ_SHORT_NAME}
            label=""
            valueId={shortNameFilterId}
            enterpriseId={referenceEnterpriseId}
            showInlineCreateButton={false}
            onChange={(id) => onShortNameFilterChange(id)}
            className={styles.dictionaryFilterItem}
          />
          <TmzDictionarySelect
            attrField="size"
            dictionaryType={TypeReference.TMZ_SIZE}
            label=""
            valueId={sizeFilterId}
            enterpriseId={referenceEnterpriseId}
            showInlineCreateButton={false}
            onChange={(id) => onSizeFilterChange(id)}
            className={styles.dictionaryFilterItem}
          />
          <TmzDictionarySelect
            attrField="color"
            dictionaryType={TypeReference.TMZ_COLOR}
            label=""
            valueId={colorFilterId}
            enterpriseId={referenceEnterpriseId}
            showInlineCreateButton={false}
            onChange={(id) => onColorFilterChange(id)}
            className={styles.dictionaryFilterItem}
          />
          <TmzDictionarySelect
            attrField="manufacture"
            dictionaryType={TypeReference.TMZ_MANUFACTURE}
            label=""
            valueId={manufactureFilterId}
            enterpriseId={referenceEnterpriseId}
            showInlineCreateButton={false}
            onChange={(id) => onManufactureFilterChange(id)}
            className={styles.dictionaryFilterItem}
          />
        </div>
      )}
    </div>
  );
});

ReferencesListSearch.displayName = 'ReferencesListSearch';
