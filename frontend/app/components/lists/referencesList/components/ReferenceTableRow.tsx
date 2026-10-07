import React, { memo } from 'react';
import cn from 'classnames';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import {
  REFERENCE_TYPE_CONFIG,
  TMZ_LIST_SHOW_ARTICLE,
  TMZ_LIST_SHOW_COMMENT,
  TMZ_LIST_SHOW_ENTERPRISE_CODE,
  TMZ_LIST_SHOW_ID,
} from '../constants';
import { markToDelete } from '../helpers/references.functions';
import { useAppContext } from '@/app/context/app.context';
import { UserRoles } from '@/app/interfaces/user.interface';
import { productionTypeList, typeSectionList, typePartnersList } from '../../../reference/helpers/reference.constants';
import IcoTrash from '../ico/trash.svg';
import IcoFolderPlus from '../ico/folderPlus.svg';
import IcoFolderOpen from '../ico/folderOpen.svg';
import IcoItem from '../ico/item.svg';
import styles from '../referencesList.module.css';
import {
  openStreetMapUrl,
  parsePartnerLocationLatLon,
} from '@/app/utils/openStreetMapUrl';
import { ReferenceImageThumb } from './ReferenceImageThumb';
import {
  canCreateReference,
  canDeleteReference,
  canViewReference,
} from '@/app/utils/referencePermissions';
import { TypeReference } from '@/app/interfaces/reference.interface';
import IcoView from '../ico/view.svg';

interface ReferenceTableRowProps {
  item: ReferenceModel;
  referenceType: string;
  references: any;
  token: string | undefined;
  setMainData: Function | undefined;
  getReference: (id: number | undefined, setMainData: Function | undefined, token: string | undefined) => void;
  className?: string;
  level?: number;
  isFolder?: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  onToggleFolder?: () => void;
  enterprises?: any[];
  isLastActive?: boolean;
  onOpenForEdit?: () => void;
  onFindUsage?: (item: ReferenceModel) => void;
  onMarkToDelete?: (item: ReferenceModel) => void;
  onDeletePermanent?: (item: ReferenceModel) => void;
  onDuplicate?: (item: ReferenceModel) => void;
}

export const ReferenceTableRow = memo<ReferenceTableRowProps>(({
  item,
  referenceType,
  references,
  token,
  setMainData,
  getReference,
  className,
  level = 0,
  isFolder = false,
  hasChildren = false,
  isOpen = false,
  onToggleFolder,
  enterprises = [],
  isLastActive = false,
  onOpenForEdit,
  onFindUsage,
  onMarkToDelete,
  onDeletePermanent,
  onDuplicate,
}) => {
  const { mainData } = useAppContext();
  const { user } = mainData.users;
  const isAdmin = user?.role === UserRoles.ADMINGLOBAL;
  const isPartners = referenceType === 'PARTNERS';
  const config = REFERENCE_TYPE_CONFIG[referenceType as keyof typeof REFERENCE_TYPE_CONFIG];
  const isTMZ = referenceType === 'TMZ';
  const isWorks = referenceType === 'WORKS';
  const refType = referenceType as TypeReference;
  const canView = canViewReference(user, refType);
  const canDelete = canDeleteReference(user, refType);
  const canDuplicate = isTMZ && !isFolder && canCreateReference(user, refType);

  // Получаем название организации
  const getEnterpriseName = () => {
    if (!isAdmin) return '';
    if (item.enterprise?.name) return item.enterprise.name;
    if (item.enterpriseId && enterprises && enterprises.length > 0) {
      const enterprise = enterprises.find((e: any) => e.id === item.enterpriseId);
      return enterprise?.name || '';
    }
    return item.enterpriseId === null ? 'Умум' : '';
  };

  const getEnterpriseCode = () => {
    if (!isAdmin) return '';
    if (item.enterprise?.code) return item.enterprise.code;
    if (item.enterpriseId && enterprises && enterprises.length > 0) {
      const enterprise = enterprises.find((e: any) => e.id === item.enterpriseId);
      return enterprise?.code || '';
    }
    return item.enterpriseId === null ? '—' : '';
  };

  const handleRowClick = () => {
    // При одном клике на строку папки - открываем/закрываем дочерние элементы
    if (isFolder && hasChildren && onToggleFolder) {
      onToggleFolder();
    }
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    if ((e.ctrlKey || e.metaKey) && canDuplicate) {
      onDuplicate?.(item);
      return;
    }
    if (!canView) return;
    onOpenForEdit?.();
    getReference(item.id, setMainData, token);
  };

  const handleDeleteClick = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    if (!item.id) return;
    if (e.ctrlKey) {
      onDeletePermanent?.(item);
      return;
    }
    if (onMarkToDelete) {
      onMarkToDelete(item);
      return;
    }
    // fallback to old flow if callback not provided
    markToDelete(item.id, item.name, token, setMainData);
  };

  const handleFindUsage = () => {
    if (!item.id) return;
    onFindUsage?.(item);
  };

  const renderImageCell = () => (
    <td className={styles.imageColumn}>
      <ReferenceImageThumb
        isFolder={isFolder}
        refValues={item.refValues}
        alt={item.name}
      />
    </td>
  );

  const renderTypeFields = () => {
    if (!config) return null;

    return config.fields.map((field, index) => {
      const fieldName = String(field);
      let value: any = '';
      
      // Специальная обработка для typeSection - показываем читаемое название
      if (fieldName === 'typeSection') {
        const typeSectionValue = item.refValues?.[fieldName];
        if (typeSectionValue) {
          const sectionItem = typeSectionList.find(item => item.name === typeSectionValue);
          value = sectionItem?.title || typeSectionValue;
        } else {
          value = '';
        }
      }
      // Специальная обработка для typePartners - показываем читаемое название
      else if (fieldName === 'typePartners') {
        const typePartnersValue = item.refValues?.[fieldName];
        if (typePartnersValue) {
          const partnerItem = typePartnersList.find(item => item.name === typePartnersValue);
          value = partnerItem?.title || typePartnersValue;
        } else {
          value = '';
        }
      }
      // Специальная обработка для typeTMZ - показываем сырое значение enum
      else if (fieldName === 'typeTMZ') {
        value = item.refValues?.[fieldName] || '';
      }
      // Специальная обработка для productionType - показываем читаемое название
      else if (fieldName === 'productionType') {
        const productionTypeValue = item.refValues?.[fieldName];
        if (productionTypeValue) {
          const productionItem = productionTypeList.find(item => item.name === productionTypeValue);
          value = productionItem?.title || productionTypeValue;
        } else {
          value = '';
        }
      }
      else if (fieldName === 'workDeptId') {
        const deptId = item.refValues?.workDeptId;
        if (deptId && Array.isArray(references)) {
          const dept = references.find((r: any) => r.id === deptId);
          value = dept?.name || '';
        } else {
          value = '';
        }
      }
      else if (fieldName === 'article') {
        value = item.article || '';
      }
      else if (fieldName === 'importedFromXlsx') {
        value = item.refValues?.importedFromXlsx ? (
          <span className={styles.importedBadge}>Excel</span>
        ) : (
          ''
        );
      }
      else if (fieldName === 'location') {
        const raw = item.refValues?.location;
        if (!raw || typeof raw !== 'string') {
          return (
            <td
              key={index}
              className={cn(styles.types, styles.location)}
              onClick={(e) => e.stopPropagation()}
            >
              —
            </td>
          );
        }
        const pos = parsePartnerLocationLatLon(raw);
        const coordsLine = pos
          ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`
          : raw;
        const mapHref = pos ? openStreetMapUrl(pos.lat, pos.lon) : null;
        return (
          <td
            key={index}
            className={cn(styles.types, styles.location)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.locationWrap}>
              {mapHref ? (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.locationMapLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  {coordsLine}
                </a>
              ) : (
                <span className={styles.locationCoords}>{coordsLine}</span>
              )}
              <span className={styles.locationRaw} title={raw}>
                {raw}
              </span>
              <button
                type="button"
                className={styles.locationCopyBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(raw);
                }}
              >
                Копировать
              </button>
            </div>
          </td>
        );
      }
      else {
        value = item.refValues?.[fieldName as keyof typeof item.refValues];
      }

      return (
        <td key={index} className={cn(styles.types, styles[fieldName as keyof typeof styles])}>{value}</td>
      );
    });
  };

  return (
    <tr
      data-reference-id={item.id}
      onClick={handleRowClick}
      onDoubleClick={handleRowDoubleClick}
      className={cn(className, {
        [styles.deleted]: item.refValues?.markToDeleted,
        [styles.trRow]: true,
        [styles.folderRow]: isFolder,
        [styles.rootFolderRow]: isFolder && level === 0,
        [styles.secondLevelFolderRow]: isFolder && level === 1,
        [styles.nestedRow]: level > 0,
        [styles.lastActive]: isLastActive,
      })}
    >
      <td className={styles.iconColumn}>
        <div style={{ paddingLeft: `${level * 16}px` }}>
          {isFolder ? (
            <div className={cn(styles.clickable)}>
              {hasChildren ? (
                <span className={styles.expandIcon}>
                  {isOpen ? (
                    <IcoFolderOpen className={styles.folderOpenIcon} />
                  ) : (
                    <IcoFolderPlus className={styles.folderPlusIcon} />
                  )}
                </span>
              ) : (
                <IcoFolderPlus className={cn(styles.folderIcon, styles.noChildren)} />
              )}
            </div>
          ) : (
            <IcoItem className={styles.itemIcon} />
          )}
        </div>
      </td>
      
      {(!isTMZ || TMZ_LIST_SHOW_ID) && (
        <td className={styles.rowId}>{item.id}</td>
      )}

      {isTMZ && TMZ_LIST_SHOW_ARTICLE && (
        <td className={cn(styles.types, styles.article)}>
          {item.article || ''}
        </td>
      )}

      {renderImageCell()}
      
      <td className={cn(className, styles.name, isPartners && styles.namePartners)}>
        <span 
          style={{ 
            paddingLeft: `${level * 24}px`,
            display: 'inline-block',
            minWidth: 'fit-content'
          }}
        >
          {item.name}
        </span>
      </td>
      
      {renderTypeFields()}
      
      {isAdmin && isTMZ && TMZ_LIST_SHOW_ENTERPRISE_CODE && (
        <td className={styles.enterpriseIdColumn}>{getEnterpriseCode()}</td>
      )}
      {isAdmin && !isTMZ && <td className={styles.enterpriseColumn}>{getEnterpriseName()}</td>}
      
      {!isPartners && !isWorks && (!isTMZ || TMZ_LIST_SHOW_COMMENT) && (
        <td className={styles.comment}>{item.refValues?.comment}</td>
      )}
      
      <td className={styles.rowAction}>
        <div className={styles.btns}>
          <IcoView
            className={styles.icoShow}
            onClick={handleFindUsage}
            title="Боғланишларни топиш"
          />
          {canDelete && (
            <IcoTrash
              className={cn(className, styles.icoTrash, {
                [styles.deleted]: item.refValues?.markToDeleted,
              })}
              onClick={handleDeleteClick}
              title="Клик: ўчиришга белгилаш; Ctrl+клик: тўлиқ ўчириш"
            />
          )}
        </div>
      </td>
    </tr>
  );
});

ReferenceTableRow.displayName = 'ReferenceTableRow';
