'use client'
import { DefaultReprtsProps } from './defaultReports.props';
import styles from './defaultReports.module.css';
import { useEffect } from 'react';
import BarChart from '../charts/barChart';
import PieChart from '../charts/pieChart';
import { Boxses } from '../boxses/boxses';
import { defaultReportData } from './data';
import { useAppContext } from '@/app/context/app.context';

export const DefaultReports = ({className, reportType, ...props }: DefaultReprtsProps) :JSX.Element => {
    
    const { setMainData, mainData } = useAppContext();
    useEffect(() => {
        if (reportType && setMainData) {
            setMainData('contentName', reportType);
            setMainData('contentTitle', getReportTitle(reportType));
        }
    }, [reportType, setMainData]);
    
    const getReportTitle = (type: string): string => {
        switch (type) {
            case 'AktSverka':
                return 'Солиштирма далолатнома';
            default:
                return 'Хисобот';
        }
    };
    
    if (reportType && ['AktSverka'].includes(reportType)) {
        return <></>;
    }
    
    const datas = defaultReportData
   
    return (
       <div className={styles.container}>
            <Boxses data={datas} />
            <div className={styles.chartContainer}>
                <BarChart />
                <PieChart />
            </div>
       </div>
    )
} 

