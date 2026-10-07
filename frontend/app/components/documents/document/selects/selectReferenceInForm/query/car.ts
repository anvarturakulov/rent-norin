import { CarType, ReferenceModel, TypeReference } from "@/app/interfaces/reference.interface"
import { Maindata } from "@/app/context/app.context.interfaces";
import { DocSTATUS, DocumentType } from '@/app/interfaces/document.interface';

export const car = (item: ReferenceModel, type: string, contentName: string, typeReference: TypeReference, mainData: Maindata): boolean => {
    
    if (type == 'car') {
        // Для car показываем только автомобили (CARS)
        if (typeReference == TypeReference.CARS) {
            // Исключаем папки
            if (item.isFolder) {
                return false;
            }
            
            // Для GateIncome показываем только машины типа STRANGER
            if (contentName === DocumentType.GateIncome) {
                return item.refValues?.carType === CarType.STRANGER;
            }
            
            // Для остальных документов исключаем VIP машины
            if (item.refValues?.carType === CarType.VIP) {
                return false;
            }
            return true;
        }
    }
    return false;
}
