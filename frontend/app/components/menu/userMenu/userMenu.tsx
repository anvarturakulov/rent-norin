'use client'
import styles from './userMenu.module.css'
import cn from 'classnames';
import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { getKeyEnum } from '@/app/service/common/getKeyEnum';
import { ReportOptions } from '@/app/interfaces/report.interface';
import { MenuItem } from '@/app/interfaces/menu.interface';
import { ContentType } from '@/app/interfaces/general.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Section } from '../../reports/dashboardReports/components/section/section';
import { RefreshPanel } from '../../reports/dashboardReports/refreshPanel/refreshPanel';
import { IntervalWindow } from '../../windows/intervalWindow/intervalWindow';
import { Maindata } from '@/app/context/app.context.interfaces';
import MiniJournal from '../../journals/miniJournal/miniJournal';
import LoadingIco from '@/app/components/common/loading.svg'
import loadingStyles from '@/app/components/common/loading.module.css'
import { UserMenuProps } from '../workersMenu/workersMenu.props';
import { UserRoles } from '@/app/interfaces/user.interface';
import { getDefinedItemIdForReceiver, getDefinedItemIdForSender } from '../../documents/document/docValues/doc.values.functions';
import { defaultDocument, defaultReportOptions } from '@/app/context/app.context.helpers.constants';
import { getDefaultDocumentDateMs } from '@/app/utils/dateInput';
import { autoMinimizeOpenEditors, resetReferenceEditorState } from '@/app/service/common/minimizeWindow';
export default function UserMenu({menuData, className, ...props}:UserMenuProps):JSX.Element {
    
    const [menu, setMenu] = useState<Array<MenuItem>>([])
    const {mainData, setMainData} = useAppContext()
    const { user } = mainData.users;
    const { informData } = mainData.report;
    const { uploadingDashboard } = mainData.window;
    
    const role = user?.role;
    let storageIdFromUser = user?.sectionId

    const onClickSubItem = (contentName: string, contentTitle: string, contentType: ContentType, mainData: Maindata) => {
        const keyItem = getKeyEnum(contentName, contentType)
        
        if (setMainData) {
            autoMinimizeOpenEditors(mainData, setMainData);
            if (contentType == 'reference') {
                resetReferenceEditorState(setMainData);
            }
            setMainData('activeMenuKey', keyItem);
            setMainData('contentType', contentType);
            setMainData('contentTitle', contentTitle);
            setMainData('contentName', contentName);
            setMainData('mainPage', false);
            setMainData('clearControlElements', true);

            if (contentType == 'document') {
                setMainData('showDocumentWindow', true);
                setMainData('isNewDocument', true);
                
                let defValue = {...defaultDocument} 
                defValue.date = getDefaultDocumentDateMs()
                defValue.documentType = contentName as DocumentType

                let definedItemIdForReceiver = getDefinedItemIdForReceiver(role, storageIdFromUser, contentName)
                let definedItemIdForSender = getDefinedItemIdForSender(role, storageIdFromUser, contentName)
                defValue.docValues.receiverId = definedItemIdForReceiver ? definedItemIdForReceiver : -1
                defValue.docValues.senderId = definedItemIdForSender ? definedItemIdForSender : -1

                setMainData('currentDocument', {...defValue});
            }

            if (contentType == 'report') {
                let defValue = {...defaultReportOptions};
                const newReportOptions:ReportOptions = {
                    ...defValue,
                    startReport: false,
                }
                setMainData('reportOption', { ...newReportOptions });
            }

            if (contentType == 'informReport') {
                console.log('📋 [userMenu] Клик на informReport:', contentName);
                // Для inform отчетов устанавливаем dashboardCurrentReportType и показываем главную страницу
                setMainData('dashboardCurrentReportType', contentName);
                setMainData('mainPage', true);
                console.log('📋 [userMenu] Установлен dashboardCurrentReportType:', contentName);
                console.log('📋 [userMenu] Установлен mainPage: true');
            }

        };
    }

    useEffect(()=> {
       setMenu(menuData)
    },[menuData])
    
    return (
        <>
            {menu.map((item, i) => (
            <>
            <ul className={styles.ul}>
                {item.subMenu.length && (
                    item.subMenu.map((elem,k)=> (
                        <>
                            {  role && elem.roles && elem.roles.includes(role) &&
                                <li 
                                    className={cn(styles.subItem)}
                                    onClick={() => onClickSubItem(elem.title, elem.description, elem.type, mainData)}
                                    key={elem.title}
                                >
                                    {elem.description? elem.description : elem.title}
                                </li>
                            }
                        </>
                    ))
                )}
            </ul>
            </>
                
            ))}


            <div className={styles.journalBox}>
                { <MiniJournal/> }
            </div>
            <RefreshPanel/>

            {
                !uploadingDashboard &&
                <>
                    {
                        user?.role == UserRoles.KASSIR &&
                        <>
                            <Section data={informData} sectionType='buxgalter' currentSection ={storageIdFromUser}/>
                        </>
                    }
                </>
            }
            {
                uploadingDashboard &&
                <LoadingIco className={loadingStyles.loadingIco} />
            }

            <IntervalWindow/>
        </>
    )
}
