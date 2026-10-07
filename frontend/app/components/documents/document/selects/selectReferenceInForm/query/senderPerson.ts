import { ReferenceModel, TypeReference } from "@/app/interfaces/reference.interface"
import { Maindata } from "@/app/context/app.context.interfaces";
import { DocSTATUS } from '@/app/interfaces/document.interface';

export const senderPerson = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata): boolean => {
    
    if (type == 'senderPerson') {
        // Для senderPerson показываем только работников (WORKERS)
        if (typeReference == TypeReference.WORKERS) {
            return !item.isFolder; // Исключаем папки
        }
        return true;
    }
    return false;
}
