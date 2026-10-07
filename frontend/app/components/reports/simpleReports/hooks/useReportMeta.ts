import { useMemo } from 'react';
import useSWR from 'swr';
import { useAppContext } from '@/app/context/app.context';
import { ReportType } from '@/app/interfaces/report.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getPropertySubconto } from '@/app/service/reports/getPropertySubconto';
import { dateToStr } from '@/app/service/reports/dateToStr';
import { useEnterpriseName } from '../../dashboardReports/hooks/useEnterpriseName';

export interface ReportMeta {
    reportTitle: string;
    enterpriseLine: string;
    periodLine: string;
    scopeLine: string;
}

export function useReportMeta(): ReportMeta | null {
    const { mainData } = useAppContext();
    const { contentTitle, contentName } = mainData.document;
    const { reportOption } = mainData.report;
    const { startDate, endDate, startReport, firstReferenceId, partnerType } = reportOption;

    const { user } = mainData.users;
    const token = user?.token;
    const url = process.env.NEXT_PUBLIC_DOMAIN + '/api/references/all/';
    const { data } = useSWR(startReport && token ? url : null, (u) => getDataForSwr(u, token));

    const enterpriseName = useEnterpriseName();

    return useMemo(() => {
        if (!startReport) return null;

        const titleV =
            firstReferenceId != null && firstReferenceId != 0
                ? getPropertySubconto(data, firstReferenceId).name
                : 'умумий корхона';

        let partnerTitle = '';
        if (contentName === ReportType.AktSverka) {
            partnerTitle =
                partnerType === 'CLIENTS'
                    ? 'МИЖОЗ'
                    : partnerType === 'SUPPLIERS'
                      ? 'ТАЪМИНОТЧИ'
                      : 'ИЧКИ КОРХОНА';
        }

        const scopeSuffix = partnerTitle ? ` (${partnerTitle})` : '';

        return {
            reportTitle: `${contentTitle} хисоботи`,
            enterpriseLine: enterpriseName ? `Корхона: ${enterpriseName}` : '',
            periodLine: `Хисобот даври: ${dateToStr(startDate)} дан ${dateToStr(endDate)}`,
            scopeLine: `${titleV}${scopeSuffix} буйича`,
        };
    }, [
        startReport,
        contentTitle,
        contentName,
        data,
        firstReferenceId,
        partnerType,
        enterpriseName,
        startDate,
        endDate,
    ]);
}
