'use client';

import { AktSverkaProps } from './aktSverka.props';
import styles from './aktSverka.module.css';
import { AktSverkaItem } from './aktSverkaItem/aktSverkaItem';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import {
  getAktSverkaInform,
  AktSverkaPartnerType,
  AktSverkaResponse,
} from '@/app/service/reports/getAktSverkaInform';
import { SelectPartnerType } from '@/app/components/reports/simpleReports/optionsBox/components/selectPartnerType/selectPartnerType';
import { SelectReference } from '@/app/components/reports/simpleReports/optionsBox/components/selectReference/selectReference';
import { TypeReference } from '@/app/interfaces/reference.interface';

function partnerTypeToSchet(partnerType: AktSverkaPartnerType | undefined | null): string {
  switch (partnerType) {
    case 'CLIENTS':
      return '40';
    case 'SUPPLIERS':
      return '60';
    case 'DEPARTMENTS':
      return '41';
    default:
      return '41';
  }
}

export const AktSverka = ({ className, ...props }: AktSverkaProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { dateStart, dateEnd } = mainData.journal.interval;
  const { reportOption, selectedEnterpriseId, dashboardReturnReportType } =
    mainData.report;
  const { partnerType, firstReferenceId } = reportOption;
  const { user } = mainData.users;
  const token = user?.token || '';

  const [reportData, setReportData] = useState<AktSverkaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterpriseName = useEnterpriseName();
  const selectedSchet = useMemo(
    () => partnerTypeToSchet(partnerType as AktSverkaPartnerType),
    [partnerType],
  );

  const urlReferences = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/all/';
  const { data: references } = useSWR(
    token ? urlReferences : null,
    (url) => getDataForSwr(url, token),
  );

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    if (!dateStart || !dateEnd) {
      setError('Саналарни танланг');
      return;
    }

    if (!partnerType) {
      setError('Хамкор турини танланг');
      return;
    }

    if (
      firstReferenceId === null ||
      firstReferenceId === undefined ||
      firstReferenceId === 0
    ) {
      setError('Хамкорни танланг');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getAktSverkaInform(
        partnerType as AktSverkaPartnerType,
        firstReferenceId,
        dateStart,
        dateEnd,
        selectedEnterpriseId,
        token,
      );
      setReportData(data);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Маълумот юклашда хатолик юз берди';
      setError(message);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    token,
    dateStart,
    dateEnd,
    partnerType,
    firstReferenceId,
    selectedEnterpriseId,
  ]);

  useEffect(() => {
    if (
      !token ||
      !dateStart ||
      !dateEnd ||
      !partnerType ||
      firstReferenceId === null ||
      firstReferenceId === undefined ||
      firstReferenceId === 0
    ) {
      return;
    }
    void loadData();
  }, [token, dateStart, dateEnd, partnerType, firstReferenceId, loadData]);

  const values = reportData?.values || [];

  const showBackToBalance = dashboardReturnReportType === 'DebitorKreditor';

  const handleBackToBalance = useCallback(() => {
    setMainData('dashboardCurrentReportType', 'DebitorKreditor');
    setMainData('dashboardReturnReportType', null);
  }, [setMainData]);

  return (
    <div className={styles.container} {...props}>
      <div className={styles.titleRow}>
        <div className={styles.title}>
          Солиштирма далолатнома
          {enterpriseName && <span> - {enterpriseName}</span>}
        </div>
        {showBackToBalance && (
          <button
            type="button"
            className={styles.backButton}
            onClick={handleBackToBalance}
          >
            ← Баланс
          </button>
        )}
      </div>

      <div className={styles.filters}>
        <SelectPartnerType visible={true} />
        <SelectReference
          label="Хамкор"
          visible={true}
          typeReference={TypeReference.PARTNERS}
          id="firstReferenceId"
        />
        <button
          type="button"
          className={styles.refreshButton}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? 'Юкланмокда...' : 'Янгилаш'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Маълумот юкланмокда...</div>}

      {!loading && !error && reportData && values.length === 0 && (
        <div className={styles.loading}>Маълумот мавжуд эмас</div>
      )}

      {!loading && values.length > 0 && (
        <div className={styles.itemsBox}>
          {values
            .slice()
            .sort((a: { name?: string }, b: { name?: string }) =>
              (a.name || '').localeCompare(b.name || ''),
            )
            .map((element: any, key: number) => (
              <AktSverkaItem
                key={element.sectionId ?? key}
                item={element}
                references={references}
                selectedSchet={selectedSchet}
              />
            ))}
        </div>
      )}
    </div>
  );
};
