import { ReferenceModel, TypeReference } from "@/app/interfaces/reference.interface"
import { Maindata } from "@/app/context/app.context.interfaces";

export const materialResponsiblePerson = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata): boolean => {
    
    if (type == 'materialResponsiblePerson') {
        // Для materialResponsiblePerson показываем только работников (WORKERS)
        if (typeReference == TypeReference.WORKERS) {
            const { user } = mainData.users;
            const userEnterpriseId = user?.enterpriseId;
            const itemEnterpriseId = item.enterpriseId;
            
            // Показываем работников своего предприятия или общих (enterpriseId === null)
            return !item.isFolder && (itemEnterpriseId === userEnterpriseId || itemEnterpriseId === null);
        }
        return false;
    }
    return false;
}









