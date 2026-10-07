import { ReferenceModel, TypePartners, TypeReference, TypeSECTION, TypeTMZ } from "@/app/interfaces/reference.interface"
import { Maindata } from "@/app/context/app.context.interfaces";
import { UserRoles } from "@/app/interfaces/user.interface";
import { DocSTATUS, DocumentType } from '@/app/interfaces/document.interface';


export const productForCharge = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata ): boolean => {
    
    if (type == 'productForCharge') {
        if (contentName === DocumentType.LeaveOnlyOneMaterial) {
            return item.refValues?.typeTMZ == TypeTMZ.MATERIAL && !item.isFolder;
        }
        return (item.refValues?.typeTMZ == TypeTMZ.PRODUCT && !item.isFolder)    
    }
    return false
}

