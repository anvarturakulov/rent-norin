'use client'
import { RefreshPanelProps } from './resfreshPanel.props';
import styles from './refreshPanel.module.css';
import { useAppContext } from '@/app/context/app.context';
import { Button } from '../../../common/button/Button';
import { Maindata } from '@/app/context/app.context.interfaces';
import DateIco from './date.svg'
import { dateNumberToString } from '@/app/service/common/converterForDates';
import { getInformation } from '@/app/service/reports/getInformation';
import { SelectReportType } from './selectReportType/selectReportType';
import { EnterpriseSelector } from './enterpriseSelector/enterpriseSelector';
export const RefreshPanel = ({className, ...props }: RefreshPanelProps) :JSX.Element => {
    const {mainData, setMainData} = useAppContext();
    const {dateStart, dateEnd} = mainData.journal.interval;
    const refreshReport = (mainData: Maindata, setMainData: Function | undefined) => {
        getInformation(setMainData, mainData);
    }
    
    const dateStartInStr = dateNumberToString(dateStart)
    const dateEndInStr = dateNumberToString(dateEnd)

    return (
       <>
            <div className={styles.box}>
                <div className={styles.selectBox}>  
                    <SelectReportType/>
                    <EnterpriseSelector/>
                    
                    <DateIco 
                        className={styles.ico}
                        onClick={(mainData: Maindata) => {
                            if (setMainData) {
                                setMainData('showIntervalWindow', true);
                                }
                            }}
                    />
                </div>
                <div>{`Cана: ${dateStartInStr} дан ${dateEndInStr} гача`}</div>
                <Button className={styles.btn} appearance='primary' onClick={(e) => refreshReport(mainData, setMainData)}>Хисоботни шакиллантириш</Button>
            </div>
       </>
    )
} 