import { SelectReportTypeProps } from './selectReportType.props';
import styles from './selectReportType.module.css';
import { useAppContext } from '@/app/context/app.context';
import cn from 'classnames';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DashboardReportData } from '@/app/data/report';
import { DashboardReportItem } from '@/app/interfaces/report.interface';
import { filterDashboardReports, patchMenuVisibilityInformReports } from '@/app/utils/menuFilter';
import { useMemo, FC } from 'react';
import { UserRoles } from '@/app/interfaces/user.interface';
import { isGlobalRole } from '@/app/utils/roleHelpers';
import useSWR from 'swr';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { getInformation } from '@/app/service/reports/getInformation';

export const SelectReportType: FC<SelectReportTypeProps> = ({ className, ...props }) => {
    const {mainData, setMainData} = useAppContext();
    const { dashboardCurrentReportType } = mainData.report;
    const { user } = mainData.users;
    const { menuVisibility } = mainData.enterpriseSettings;
    const singleEnterpriseMode = mainData.settings?.singleEnterpriseMode ?? false;
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
    
    // Фильтруем отчеты на основе настроек предприятия или глобальных настроек
    const filteredData = useMemo(() => {
        // ADMINGLOBAL всегда видит все отчеты (без фильтрации по настройкам)
        if (user?.role === UserRoles.ADMINGLOBAL) {
            return DashboardReportData;
        }

        if (!user?.role) {
            return [];
        }

        // Для GLOBAL ролей используем глобальные настройки
        if (isGlobal) {
            if (globalMenuVisibility) {
                return filterDashboardReports(
                    DashboardReportData,
                    user.role,
                    patchMenuVisibilityInformReports(globalMenuVisibility),
                );
            }
            // Если глобальные настройки не заданы, возвращаем пустой массив (whitelist подход)
            return [];
        }

        // Для обычных ролей используем настройки предприятия
        if (!user?.enterpriseId) {
            // Если нет enterpriseId, возвращаем пустой массив (whitelist подход)
            return [];
        }

        // Применяем фильтрацию на основе настроек предприятия
        if (menuVisibility) {
            return filterDashboardReports(
                DashboardReportData,
                user.role,
                patchMenuVisibilityInformReports(menuVisibility),
            );
        }

        // Если настройки не заданы, возвращаем пустой массив (whitelist подход)
        return [];
    }, [user?.role, user?.enterpriseId, menuVisibility, isGlobal, globalMenuVisibility]);

    const visibleReports = useMemo(() => {
        if (singleEnterpriseMode) {
            return filteredData.filter((item: DashboardReportItem) => item.code !== 'EnterpriseIntercompanyReport');
        }
        return filteredData;
    }, [filteredData, singleEnterpriseMode]);
    
    const changeElements = async (e: React.FormEvent<HTMLSelectElement>, setMainData: Function | undefined, mainData: Maindata) => {
        let target = e.currentTarget;
        let dashboardCurrentReportType = target[target.selectedIndex].getAttribute('data-type');
        
        console.log('📊 [selectReportType] Выбран отчет:', dashboardCurrentReportType);

        if ( setMainData ) {
            setMainData('dashboardReturnReportType', null);
            setMainData('dashboardCurrentReportType', dashboardCurrentReportType);
            console.log('📊 [selectReportType] Установлен dashboardCurrentReportType:', dashboardCurrentReportType);
            
            if (!dashboardCurrentReportType) {
                return;
            }

            const updatedMainData = {
                ...mainData,
                report: {
                    ...mainData.report,
                    dashboardCurrentReportType,
                    dashboardReturnReportType: null,
                }
            };
            
            getInformation(setMainData, updatedMainData as Maindata);
        }
    }
 
    return (
        <div className={styles.box}>
            <select
                className={cn(styles.select)}
                {...props}
                value={dashboardCurrentReportType || ''}
                onChange={(e) => changeElements(e, setMainData, mainData)}
            >   
                <option 
                    value={''} 
                    className={cn(styles.option, styles.chooseMe)}
                    data-type='' 
                    key={'Танланмаган'}>
                        {'Жамланма-хисобот турини танланг'}
                </option>
                {visibleReports && visibleReports.length>0  &&
                visibleReports.map(( item:DashboardReportItem ) => (
                    <option 
                        className={styles.option}
                        key = {item.code}
                        value={item.code}
                        data-type={item.code}
                        >
                            {item.title}
                    </option>  
                ))}
            </select>
        </div>
    );
};
