import { OptionsBoxProps } from './optionsBox.props';
import styles from './optionsBox.module.css';
import { Input } from '@/app/components';
import { getOptionsByReportType } from '@/app/service/reports/getOptionsByReportType';
import { SelectReference } from './components/selectReference/selectReference';
import { MatOborotTmzCatalogPicker } from './components/matOborotTmzCatalogPicker/matOborotTmzCatalogPicker';
import { SelectMatOborotType } from './components/selectMatOborotType/selectMatOborotType';
import { useAppContext } from '@/app/context/app.context';
import { onChangeInputOptionsBox } from './helpers/optionsBox.functions';
import { ReportType } from '@/app/interfaces/report.interface';
import { SelectOborot } from './components/selectOborot/selectOborot';
import { generateSimpleReport } from '@/app/service/reports/generateSimpleReport';
import { SelectPartnerType } from './components/selectPartnerType/selectPartnerType';
import { EnterpriseSelector } from '../../dashboardReports/refreshPanel/enterpriseSelector/enterpriseSelector';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import { formatDateForInput } from '@/app/utils/dateInput';
import React, { useMemo } from 'react';


export default function OptionsBox({ className, ...props }: OptionsBoxProps): JSX.Element {
    
    const {mainData, setMainData} = useAppContext();
    const {contentName, contentTitle} = mainData.document;
    const {reportOption} = mainData.report;
    const {user} = mainData.users;
    
    // Пересчитываем result при изменении contentName или schet
    const result = useMemo(() => {
        return getOptionsByReportType(contentName, reportOption.schet);
    }, [contentName, reportOption.schet]);
    
    // Проверяем, является ли пользователь глобальным для отображения селектора организации
    const isGlobal = useMemo(() => {
        return user?.role && isGlobalRole(user.role);
    }, [user?.role]);

    // superKassir может выбирать организацию в отчёте (как HEADGLOBAL)
    const canSelectEnterprise = useMemo(() => {
        return isGlobal || user?.superKassir === true;
    }, [isGlobal, user?.superKassir]);

    const isButtonEnabled = (() => {
        const { startDate, endDate } = reportOption;

        if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
            return false;
        }

        return startDate <= endDate;
    })();

    return (
        <div className={styles.box}>
            <h2 className={styles.title}>Хисобот параметрлари</h2>
            <p className={styles.subtitle}>
                {contentTitle ? `${contentTitle} — ` : ''}давр ва фильтрларни танланг
            </p>

            <div className={styles.formFields}>
                {canSelectEnterprise && (
                    <div className={styles.dataBoxBottom}>
                        <EnterpriseSelector />
                    </div>
                )}

                <div className={styles.dataBox}>
                    <Input
                        label='Бошлангич сана'
                        type='date'
                        id='startDate'
                        value={reportOption.startDate ? formatDateForInput(reportOption.startDate) : ''}
                        onChange={(e)=> onChangeInputOptionsBox(e, setMainData, mainData)}
                    />
                    <Input
                        label='Охирги сана'
                        type='date'
                        id='endDate'
                        value={
                            reportOption.endDate
                                ? formatDateForInput(reportOption.endDate)
                                : ''
                        }
                        onChange={(e) => onChangeInputOptionsBox(e, setMainData, mainData)}
                    />
                </div>

                <div className={styles.dataBoxBottom}>
                    <SelectMatOborotType
                        label='ТМБ тури'
                        visible={contentName == ReportType.MatOborot}
                    />
                </div>

                <div className={styles.dataBoxBottom}>
                    <SelectOborot 
                        label='Айланма тури' 
                        visible={contentName == ReportType.Oborotka}
                    />
                </div>

                <div className={styles.dataBoxBottom}>
                    <SelectPartnerType       
                        visible={contentName == ReportType.AktSverka}
                    />
                </div>
                
                <div className={styles.dataBoxBottom}>
                    <SelectReference 
                        label={result.label} 
                        typeReference={result.typeReference} 
                        id={'firstReferenceId'}
                        visible={true}
                    />
                </div>

                {contentName == ReportType.MatOborot && (
                    <div className={styles.dataBoxBottom}>
                        <MatOborotTmzCatalogPicker />
                    </div>
                )}
            </div>

            <button 
                className={`${styles.button} ${!isButtonEnabled ? styles.buttonDisabled : ''}`}
                onClick={() => generateSimpleReport(setMainData, mainData)}
                disabled={!isButtonEnabled}
            >
                {isButtonEnabled ? 'Хисоботни шакллантириш' : 'Санани тулдиринг'}
            </button>
        </div>
    )
} 