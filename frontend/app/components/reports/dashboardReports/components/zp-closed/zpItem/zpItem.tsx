// 'use client'
// import { ZpItemProps } from './zpItem.props';
// import styles from './zpItem.module.css';
// import { Htag } from '@/app/components';
// import { useAppContext } from '@/app/context/app.context';
// import { HamirModel } from '@/app/interfaces/hamir.interface';
// import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';

// const colHamirsByWorker = (workerId:string, sectionId:string, hamirs:Array<HamirModel>) => {
//     let colHamirs = 0;
//     let currentHamirs;

//     if (hamirs) {
//         currentHamirs = hamirs.filter((item: HamirModel) => {
//             let arr = [item.firstWorker, item.secondWorker, item.thirdWorker]
//             return (
//                 item.sectionId == sectionId &&
//                 item.proveden &&
//                 item.zuvala && 
//                 arr.includes(workerId)
//             )
//         })
//         colHamirs = currentHamirs.length
//     }
//     return colHamirs
// } 

// export const ZpItem = ({className, currentId, data, hamirs, title, ...props }: ZpItemProps) :JSX.Element => {

//     const {mainData, setMainData} = useAppContext()
    
//     return (
//        <>
//         <div className={styles.item}>
//             <Htag tag='h1'>{title}</Htag>
            
//             {
//                 data &&
//                 data
//                 .filter((item:ReferenceModel) => item.typeReference == TypeReference.WORKERS)
//                 .map((item: ReferenceModel) => {
//                     let colHamirs = 0;
//                     if (item._id && currentId) {
//                        colHamirs = colHamirsByWorker(item._id, currentId, hamirs)
//                     }
                    
//                     if ( item._id && currentId && colHamirs ) 
//                         return (
//                             <div className={styles.row}>
//                                 <div className={styles.title}>{item.name}</div>
//                                 <div className={styles.value}>{colHamirs}</div>
//                             </div>
//                         )
//                 })
//             }
            
            
//         </div>
//       </>
//     )
// } 