import React, { memo, useMemo, useEffect, useCallback } from 'react';
import { InputForDate } from '../../inputs/inputForDate/inputForDate';
import { InputForDateTime } from '../../inputs/inputForDateTime/inputForDateTime';
import { Info } from '@/app/components';
import styles from '../docValues.module.css';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { UserRoles } from '@/app/interfaces/user.interface';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { MenuVisibilitySettings } from '@/app/interfaces/enterprise.interface';
import { DocSTATUS, DocumentType, RentTariffType } from '@/app/interfaces/document.interface';
import { recalcTransferToolsTableTariffs } from '@/app/service/documents/buildTransferToolsRow';
import { normalizeRentTariffType } from '@/app/service/documents/rentTariffType';

interface InfoSectionProps {
  contentTitle: string;
  documentId: number | undefined;
}

const InfoSection = memo<InfoSectionProps>(({
  contentTitle,
  documentId
}) => {
  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const { isNewDocument, currentDocument, contentName } = mainData.document;
  const token = user?.token;
  const isGlobal = user?.role && isGlobalRole(user.role);
  
  // Загружаем глобальные настройки для GLOBAL ролей
  const globalSettingsUrl = isGlobal && token 
    ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/global/menuVisibility`
    : null;
  const { data: globalMenuVisibility } = useSWR(
    globalSettingsUrl,
    (url) => getDataForSwr(url, token)
  );

  // Проверяем, может ли пользователь редактировать организацию
  const canEditEnterprise = useMemo(() => {
    if (!isNewDocument) return false;
    
    if (!user?.role) return false;

    if (user.role === UserRoles.ADMINGLOBAL) {
      return true;
    }
    
    // Для GLOBAL ролей проверяем право canEditDocuments
    if (isGlobal && globalMenuVisibility) {
      const roleSettings = (globalMenuVisibility as MenuVisibilitySettings)[user.role];
      return roleSettings?.canEditDocuments === true;
    }

    
    return false;
  }, [isNewDocument, user?.role, isGlobal, globalMenuVisibility]);

  const { data: enterprises } = useSWR(
    token ? 'enterprises' : null,
    () => getEnterprises(token)
  );

  // Получаем название предприятия пользователя
  const userEnterpriseName = useMemo(() => {
    if (!user?.enterpriseId || !enterprises || !Array.isArray(enterprises)) {
      return null;
    }
    const enterprise = enterprises.find((item: any) => item.id === user.enterpriseId);
    return enterprise?.name || null;
  }, [user?.enterpriseId, enterprises]);

  const documentEnterpriseName = useMemo(() => {
    if (!currentDocument?.enterpriseId || !enterprises || !Array.isArray(enterprises)) {
      return null;
    }
    const enterprise = enterprises.find((item: any) => item.id === currentDocument?.enterpriseId);
    return enterprise?.name || null;
  }, [currentDocument?.enterpriseId, enterprises]);

  // Показываем название предприятия только при создании нового документа для пользователей предприятия
  const shouldShowEnterpriseName = (isNewDocument && userEnterpriseName) || (documentEnterpriseName && !isNewDocument);

  // Устанавливаем enterpriseId из пользователя, если у пользователя нет права canEditDocuments
  useEffect(() => {
    if (!isNewDocument || !currentDocument || !user) return;
    
    // Если enterpriseId уже установлен, не меняем его
    if (currentDocument.enterpriseId) return;
    
    // Для GLOBAL ролей проверяем право canEditDocuments
    if (isGlobal && globalMenuVisibility) {
      const roleSettings = (globalMenuVisibility as MenuVisibilitySettings)[user.role];
      const hasEditPermission = roleSettings?.canEditDocuments === true;
      
      // Если нет права редактировать, устанавливаем enterpriseId из пользователя
      if (!hasEditPermission && user.enterpriseId) {
        if (setMainData) {
          setMainData('currentDocument', {
            ...currentDocument,
            enterpriseId: user.enterpriseId
          });
        }
      }
    } else if (user.enterpriseId) {
      // Для не-GLOBAL ролей устанавливаем enterpriseId из пользователя
      if (setMainData) {
        setMainData('currentDocument', {
          ...currentDocument,
          enterpriseId: user.enterpriseId
        });
      }
    }
  }, [isNewDocument, currentDocument, user, isGlobal, globalMenuVisibility, setMainData]);

  const handleEnterpriseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value === '' ? null : Number(e.target.value);
    if (setMainData && currentDocument) {
      setMainData('currentDocument', {
        ...currentDocument,
        enterpriseId: value
      });
    }
  };

  const rentTariffType = normalizeRentTariffType(
    currentDocument?.docValues?.rentTariffType,
  );
  const isTransferTariffEditable =
    currentDocument?.docStatus === DocSTATUS.OPEN && !currentDocument?.isLocked;

  const handleRentTariffTypeChange = useCallback(
    async (next: RentTariffType) => {
      if (!setMainData || !currentDocument) return;
      if (normalizeRentTariffType(currentDocument.docValues?.rentTariffType) === next) {
        return;
      }

      const docValues = {
        ...currentDocument.docValues,
        rentTariffType: next,
      };
      const items = currentDocument.docTableItems || [];
      const hasToolRows = items.some(
        (item) =>
          item.tableType !== 'sale' &&
          item.tableType !== 'tovar' &&
          Number(item.analiticId) > 0,
      );
      const docTableItems = hasToolRows
        ? await recalcTransferToolsTableTariffs(
            items,
            Number(currentDocument.date) || Date.now(),
            user?.token,
            currentDocument.enterpriseId ?? user?.enterpriseId,
            next,
          )
        : items;

      setMainData('currentDocument', {
        ...currentDocument,
        docValues,
        docTableItems,
      });
    },
    [currentDocument, setMainData, user?.enterpriseId, user?.token],
  );

  return (
    <div className={styles.infoBox}>
      {1 && (
        <div style={{ marginBottom: '10px', padding: '8px', background: '#f0f0f0', borderRadius: '4px', fontSize: '14px' }}>
          <strong>Корхона:</strong> {userEnterpriseName || documentEnterpriseName}
        </div>
      )}
      <div className={styles.dataBox}>
        {contentName === DocumentType.TransferToolsToClient ||
        contentName === DocumentType.OrderToolsToClient ||
        contentName === DocumentType.TransferSubleaseToolsToClient ? (
          <div className={styles.transferInfoCol}>
            <div className={styles.dataBoxDates}>
              <InputForDateTime
                label="Сана ва вақт"
                id="date"
                autoFocus={isNewDocument}
              />
              {contentName !== DocumentType.OrderToolsToClient && (
                <InputForDateTime
                  label="Ҳисоблаш санаси"
                  id="settlementDate"
                />
              )}
            </div>
            {(contentName === DocumentType.TransferToolsToClient ||
              contentName === DocumentType.OrderToolsToClient) && (
              <div className={styles.rentTariffTypeBox}>
                <div className={styles.rentTariffTypeLabel}>Тариф ижара</div>
                <div className={styles.rentTariffTypeOptions}>
                  <label className={styles.rentTariffTypeOption}>
                    <input
                      type="radio"
                      name="rentTariffType"
                      value={RentTariffType.CASH}
                      checked={rentTariffType === RentTariffType.CASH}
                      disabled={!isTransferTariffEditable}
                      onChange={() => handleRentTariffTypeChange(RentTariffType.CASH)}
                    />
                    Нақд / физ.шахс
                  </label>
                  <label className={styles.rentTariffTypeOption}>
                    <input
                      type="radio"
                      name="rentTariffType"
                      value={RentTariffType.TRANSFER}
                      checked={rentTariffType === RentTariffType.TRANSFER}
                      disabled={!isTransferTariffEditable}
                      onChange={() => handleRentTariffTypeChange(RentTariffType.TRANSFER)}
                    />
                    Перечисление
                  </label>
                </div>
              </div>
            )}
          </div>
        ) : contentName === DocumentType.ReceiveToolsFromClient ||
          contentName === DocumentType.ReceiveSubleaseToolsFromClient ? (
          <div className={styles.dataBoxDates}>
            <InputForDateTime
              label="Сана ва вақт"
              id="date"
              autoFocus={isNewDocument}
            />
            <InputForDateTime
              label="Кайтариш санаси ва вакти"
              id="returnDateTime"
            />
          </div>
        ) : (
          <InputForDate label={'Сана'} id='date' autoFocus={isNewDocument} />
        )}
        <Info content={`${documentId}`} label='№' className={styles.docNumber} />
        {Number(currentDocument?.docValues?.sourceRentalOrderDocId) > 0 && (
          <Info
            content={`${currentDocument.docValues.sourceRentalOrderDocId}`}
            label='Буюртма'
            className={styles.docNumber}
          />
        )}
        {Number(currentDocument?.docValues?.fulfilledByTransferDocId) > 0 && (
          <Info
            content={`${currentDocument.docValues.fulfilledByTransferDocId}`}
            label='Топшириш'
            className={styles.docNumber}
          />
        )}
      </div>
    </div>
  );
});

InfoSection.displayName = 'InfoSection';

export default InfoSection; 