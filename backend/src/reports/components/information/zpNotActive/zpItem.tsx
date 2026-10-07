// import { EntryItem, Schet, TypeQuery } from 'src/interfaces/report.interface';
// import { queryKor } from 'src/report/helpers/querys/queryKor';
// import { query } from 'src/report/helpers/querys/query';
// import { Hamir } from 'src/hamir/models/hamir.model';
// import { ReferenceModel, TypeReference } from 'src/interfaces/reference.interface';

// const colHamirsByWorker = (workerId:string, sectionId:string, hamirs:Array<Hamir>) => {
//     let colHamirs = 0;
//     let currentHamirs;

//     if (hamirs) {
//         currentHamirs = hamirs.filter((item: Hamir) => {
//             let arr = [item.firstWorker, item.secondWorker, item.thirdWorker]
//             return (
//                 String(item.sectionId) == sectionId &&
//                 item.proveden &&
//                 item.zuvala && 
//                 arr.includes(workerId)
//             )
//         })
//         colHamirs = currentHamirs.length
//     }
//     return colHamirs
// } 

// export const zpItem = ( 
//   data: any,
//   startDate: number | null,
//   endDate: number | null,
//   currentSectionId: string, 
//   title: string, 
//   globalEntrys: Array<EntryItem> | undefined,
//   hamirs: Hamir[] ) => {
  
//     let result = []
//     data &&
//     data
//     .filter((item:ReferenceModel) => item.typeReference == TypeReference.WORKERS)
//     .forEach((item: ReferenceModel) => {
//         let colHamirs = 0;
//         if (item._id && currentSectionId) {
//             colHamirs = colHamirsByWorker(item._id, currentSectionId, hamirs)
//         }
        
//         if ( item._id && currentSectionId && colHamirs ) {
//             let element = {
//                 name: item.name,
//                 value: colHamirs
//             }
            
//             if (Object.keys(element).length) {
//                 result.push(element)
//             }
//         }
//     })
    
  
//   return (
//     {
//         section: title,
//         items: result
//     }
      
//   )
// } 