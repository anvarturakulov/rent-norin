import { PereodicModel, ReferenceModel, TypePartners, TypeReference, TypeSECTION, TypeTMZ } from '@/app/interfaces/reference.interface';
import { showMessage } from '@/app/service/common/showMessage';
import { updateCreatePereodic } from '@/app/service/references/updateCreatePereodic';
import { updateCreateReference } from '@/app/service/references/updateCreateReference';

export const cancelSubmit = (setMainData: Function | undefined) => {
    if (setMainData) {
        setMainData('clearControlElements', true);
        setMainData('showPereodicWindow', false);
        setMainData('isNewPereodic', false);
    }
}

export const onSubmit = (
    body: PereodicModel, 
    isNewPereodic: boolean,
    setMainData: Function| undefined,
    token: string | undefined,
    enterpriseId?: number | null) => {

    const {date, name, value, referenceId} = body
    if (!date || !value || !name || !referenceId) {
        showMessage('Киритишда хатолик', 'error', setMainData);
        return
    }
    
    updateCreatePereodic(body, isNewPereodic, setMainData, token, enterpriseId);
}


export const defineTypeTMZ = (typeTMZ: string): TypeTMZ => {
    switch (typeTMZ) {
        case 'MATERIAL': return TypeTMZ.MATERIAL
        case 'PRODUCT': return TypeTMZ.PRODUCT
        case 'HALFSTUFF': return TypeTMZ.HALFSTUFF
        case 'OS': return TypeTMZ.OS
        case 'TOOLS': return TypeTMZ.TOOLS
        case 'TOVAR': return TypeTMZ.TOVAR
        default: return TypeTMZ.MATERIAL
    } 
}

export const defineTypePartners = (typePartners: string): TypePartners => {
    switch (typePartners) {
        case 'CLIENTS': return TypePartners.CLIENTS
        case 'SUPPLIERS': return TypePartners.SUPPLIERS
        default: return TypePartners.CLIENTS
    } 
}

export const defineTypeSection = (typeSection: string): TypeSECTION => {
    switch (typeSection) {
        case 'COMMON': return TypeSECTION.COMMON
        case 'CASH': return TypeSECTION.CASH
        case 'BANK': return TypeSECTION.BANK
        case 'PLASTIK': return TypeSECTION.PLASTIK
        case 'FOUNDER': return TypeSECTION.FOUNDER
        case 'PRODUCTION': return TypeSECTION.PRODUCTION
        case 'STORAGE': return TypeSECTION.STORAGE
        // Map legacy values to existing enum values
        case 'ACCOUNTANT': return TypeSECTION.COMMON
        case 'DELIVERY': return TypeSECTION.COMMON
        case 'DIRECTOR': return TypeSECTION.COMMON
        case 'FILIAL': return TypeSECTION.COMMON
        default: return TypeSECTION.COMMON
    } 
}