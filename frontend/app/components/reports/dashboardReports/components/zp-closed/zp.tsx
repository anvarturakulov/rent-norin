// 'use client'
// import { ZpProps } from './zp.props';
// import styles from './zp.module.css';
// import { ReferenceModel } from '@/app/interfaces/reference.interface';
// import { ZpItem } from './zpItem/zpItem';
// import { useAppContext } from '@/app/context/app.context';
// import { dateNumberToString } from '@/app/service/common/converterForDates';
// import useSWR from 'swr';
// import { getDataForSwr } from '@/app/service/common/getDataForSwr';
// import { useState } from 'react';

// export const Zp = ({className, data, currentSection, ...props }: ZpProps) :JSX.Element => {
//     const {mainData, setMainData} = useAppContext()

//     const {dateStart, dateEnd} = mainData.interval;
//     let dateStartForUrl = dateStart
//     let dateEndForUrl = dateEnd

//     if (!dateStart && !dateEnd) {
//         let now = Date.now()+18000000
//         let nowInstr = dateNumberToString(now)
//         dateStartForUrl = Date.parse(nowInstr)
//         dateEndForUrl = Date.parse(nowInstr) + 86399999
//     }
    

//     const { contentName, user, showDocumentWindow } = mainData;
//     const role = mainData.user?.role;
//     const token = user?.token;

//     let url = process.env.NEXT_PUBLIC_DOMAIN+'/api/hamir/byTypeForDate'+'?documentType='+contentName+'&dateStart='+dateStartForUrl+'&dateEnd='+dateEndForUrl;
    
//     const { data : hamirs, mutate } = useSWR(url, (url) => getDataForSwr(url, token));
    
//     let idForBuxanka = '65e7048b5c54490bbc335ca2';
//     let [show, setShow] = useState<boolean>(false);
    
//     return (
//        <>
//             <div className={styles.title}>
//                 {"ЦЕХДАГИ ХОДИМЛАР МАЪЛУМОТЛАРИ"}
//                 <button 
//                     className={styles.button}
//                     onClick={()=> setShow(value => !value)}>
//                         OK
//                 </button>    
//             </div>
//             {
//                 show &&
//                 <div className={styles.itemsBox}>
//                     {
//                         data && data.length > 0 &&
//                         data.filter((item: any) => {
//                             return item?.filial
//                         })
//                         .filter((item: ReferenceModel) => {
//                             if (currentSection) return item._id == currentSection
//                             else return true
//                         })
//                         .map((item: ReferenceModel, key: number) => {
//                             return <ZpItem key={key} currentId= {item._id} data={data} hamirs={hamirs} title={item.name}/>
//                         })
//                     }
//                 </div>
//             }
             
            
//        </>
//     )
// } 