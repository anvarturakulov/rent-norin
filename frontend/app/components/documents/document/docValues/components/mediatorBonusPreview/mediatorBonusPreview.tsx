'use client';

import { useMemo, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { DocumentType } from '@/app/interfaces/document.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import {
  computeMediatorBonusPreview,
  resolvePartnerPercentFromSettings,
  sumReceiveRentNetIncome,
} from '@/app/service/documents/mediatorBonus';
import { getSettingPereodicValueForDateByKey } from '@/app/service/settings/getSettingPereodicValueForDateByKey';
import { getSettingByKeyFromDB } from '@/app/service/settings/getSettingByKeyFromDB';
import { numberValue } from '@/app/service/common/converters';
import styles from './mediatorBonusPreview.module.css';

export const MediatorBonusPreview = () => {
  const { mainData } = useAppContext();
  const { currentDocument, contentName } = mainData.document;
  const token = mainData.users.user?.token;
  const enterpriseId = currentDocument?.enterpriseId ?? mainData.users.user?.enterpriseId;

  const { data: allReferences } = useSWR<ReferenceModel[]>(
    token ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/all/` : null,
    (url: string) => getDataForSwr(url, token),
  );

  const [percentSettings, setPercentSettings] = useState({
    defaultPercent: 0,
    driverPercent: 0,
    masterPercent: 0,
    minAmount: 0,
  });

  const docDate = Number(currentDocument?.date) || Date.now();
  const senderId = currentDocument?.docValues?.senderId;

  useEffect(() => {
    if (contentName !== DocumentType.ReceiveToolsFromClient || !token) return;

    let cancelled = false;
    (async () => {
      const [defaultPercent, driverPercent, masterPercent, minRaw] = await Promise.all([
        getSettingPereodicValueForDateByKey(
          'toolsRent.mediatorBonusPercent',
          docDate,
          token,
          enterpriseId,
        ),
        getSettingPereodicValueForDateByKey(
          'toolsRent.mediatorBonusPercent.driver',
          docDate,
          token,
          enterpriseId,
        ),
        getSettingPereodicValueForDateByKey(
          'toolsRent.mediatorBonusPercent.master',
          docDate,
          token,
          enterpriseId,
        ),
        getSettingByKeyFromDB('toolsRent.mediatorBonusMinAmount', token, enterpriseId),
      ]);
      if (cancelled) return;
      setPercentSettings({
        defaultPercent: Number(defaultPercent) || 0,
        driverPercent: Number(driverPercent) || 0,
        masterPercent: Number(masterPercent) || 0,
        minAmount: Number(minRaw) || 0,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [contentName, docDate, token, enterpriseId]);

  const incomeBase = useMemo(
    () => sumReceiveRentNetIncome(currentDocument),
    [currentDocument?.docTableItems, currentDocument?.id],
  );

  const partnerRef = useMemo(() => {
    if (!senderId || !Array.isArray(allReferences)) return null;
    return allReferences.find((r) => r.id === senderId) ?? null;
  }, [senderId, allReferences]);

  const hasMediatorRole = Boolean(
    partnerRef?.refValues?.isMediatorDriver || partnerRef?.refValues?.isMediatorMaster,
  );

  if (contentName !== DocumentType.ReceiveToolsFromClient) {
    return null;
  }

  const percent = resolvePartnerPercentFromSettings(
    {
      defaultPercent: percentSettings.defaultPercent,
      driverPercent: percentSettings.driverPercent,
      masterPercent: percentSettings.masterPercent,
    },
    partnerRef?.refValues,
  );
  const { bonus, belowMin } = computeMediatorBonusPreview({
    costBase: incomeBase,
    percent,
    minAmount: percentSettings.minAmount,
  });

  const showHint = senderId && Array.isArray(allReferences) && !hasMediatorRole;
  const typeLabel = partnerRef?.refValues?.isMediatorDriver
    ? 'DRIVER'
    : partnerRef?.refValues?.isMediatorMaster
      ? 'MASTER'
      : '—';

  return (
    <div className={styles.wrap}>
      {showHint && (
        <p className={styles.hint}>
          Хамкорда Хайдовчи/Уста белгиси йук - бонус хисобланмайди
        </p>
      )}
      {incomeBase > 0 && hasMediatorRole && (
        <>
          <p className={styles.summary}>
            Sof daromad: {numberValue(incomeBase)}
            {' · '}
            Ставка ({typeLabel}): {percent}%
            {' · '}
            <span className={styles.bonus}>Бонус: {numberValue(bonus)}</span>
          </p>
          {belowMin && (
            <p className={styles.warning}>
              Бонус минимал порогdan past — начисление не будет
            </p>
          )}
        </>
      )}
    </div>
  );
};
