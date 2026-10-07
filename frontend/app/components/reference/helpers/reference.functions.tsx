import { ReferenceModel, TypePartners, TypeReference, TypeSECTION, TypeTMZ, CarType, ProductionType, PriceClass, TypeMediator, isTmzAttributeDictionaryType } from '@/app/interfaces/reference.interface';
import { showMessage } from '@/app/service/common/showMessage';
import { updateCreateReference } from '@/app/service/references/updateCreateReference';
import { getPereodicValueForDate } from '@/app/service/references/getPereodicValueForDate';
import { buildTmzDisplayName, hasTmzNameParts } from '@/app/utils/buildTmzDisplayName';
import { validateUzPassportFields } from './uzPassport.validation';
import { validateUzLegalEntityFields } from './uzLegalEntity.validation';
import { validateUzJshshirFields } from './uzJshshir.validation';
import { KeyedMutator } from 'swr';

/** Первые 2 латинские буквы из названия группы (префикс артикула TMZ). */
export function extractTmzArticlePrefixFromGroupLabel(label: string): string | null {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const atStart = trimmed.match(/^[A-Za-z]{2}/);
    if (atStart) return atStart[0].toUpperCase();
    return null;
}

/** Можно подставить префикс из группы: артикул пустой или только 2 латинские буквы. */
export function canReplaceTmzArticlePrefixFromGroup(article: string | undefined | null): boolean {
    const trimmed = (article ?? '').trim();
    if (!trimmed) return true;
    return /^[A-Za-z]{2}$/i.test(trimmed);
}

export const cancelSubmit = (setMainData: Function | undefined) => {
    if (setMainData) {
        setMainData('clearControlElements', true);
        setMainData('showReferenceWindow', false);
        setMainData('isNewReference', false);
    }
}

export const onSubmit = (
    body: ReferenceModel,
    typeReference: TypeReference, 
    isNewReference: boolean, 
    setMainData: Function| undefined,
    token: string | undefined,
    mutate?: KeyedMutator<ReferenceModel[]>,
    inlineInstanceId?: string,
    inlineSlotKey?: string) => {

    // Убираем пробелы по краям перед проверками и отправкой
    if (body.article !== undefined && body.article !== null) {
        body.article = String(body.article).trim();
    }

    if (isTmzAttributeDictionaryType(typeReference)) {
        if (body.name.trim().length === 0) {
            showMessage('Қийматни тулдиринг', 'error', setMainData);
            return;
        }
        if (
            typeReference === TypeReference.TMZ_SHORT_NAME &&
            body.refValues?.typeTMZ == undefined
        ) {
            showMessage('ТМБ турини танланг', 'error', setMainData);
            return;
        }
        updateCreateReference(body, typeReference, isNewReference, setMainData, token, mutate, inlineInstanceId, inlineSlotKey);
        return;
    }

    if (typeReference == TypeReference.TMZ && body.refValues?.typeTMZ == undefined) {
        showMessage('ТМБ турини танланг', 'error', setMainData);
        return
    }

    if (typeReference == TypeReference.TMZ) {
        const article = body.article?.trim() || '';
        if (article.length < 1 || article.length > 15) {
            showMessage('Артикул мажбурий: 1 дан 15 гача белги', 'error', setMainData);
            return
        }
    }

    if (typeReference == TypeReference.STORAGES) {
        const article = body.article?.trim() || '';
        if (article.length > 15) {
            showMessage('Артикул: 1 дан 15 гача белги', 'error', setMainData);
            return
        }
    }

    if (typeReference == TypeReference.WORKS) {
        const article = body.article?.trim() || '';
        if (article.length < 1 || article.length > 15) {
            showMessage('Артикул мажбурий: 1 дан 15 гача белги', 'error', setMainData);
            return
        }
    }

    if (typeReference === TypeReference.TMZ && !body.isFolder) {
        const parts = { ...body.refValues, typeTMZ: body.refValues?.typeTMZ };
        const hasAnyPart = hasTmzNameParts(parts);
        const existingName = (body.name ?? '').trim();
        if (!hasAnyPart && !existingName) {
            showMessage('Қисқа номини тулдиринг', 'error', setMainData);
            return;
        }
        if (hasAnyPart) {
            body.name = buildTmzDisplayName(parts);
        }
    }

    if (typeReference === TypeReference.PARTNERS && body.refValues?.isIndividualPerson) {
        const passportError = validateUzPassportFields(body.refValues);
        if (passportError) {
            showMessage(passportError, 'error', setMainData);
            return;
        }
        const jshshirError = validateUzJshshirFields(body.refValues);
        if (jshshirError) {
            showMessage(jshshirError, 'error', setMainData);
            return;
        }
    }

    if (typeReference === TypeReference.PARTNERS && body.refValues?.isLegalEntity) {
        const legalEntityError = validateUzLegalEntityFields(body.refValues);
        if (legalEntityError) {
            showMessage(legalEntityError, 'error', setMainData);
            return;
        }
    }
    
    if (body.name.trim().length != 0) {
        updateCreateReference(body, typeReference, isNewReference, setMainData, token, mutate, inlineInstanceId, inlineSlotKey);
    } else {
        showMessage('Номини тулдиринг', 'error', setMainData);
    }
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
        case 'DEPARTMENTS': return TypePartners.DEPARTMENTS
        case 'SUPPLIERS': return TypePartners.SUPPLIERS
        default: return TypePartners.CLIENTS
    } 
}

export const defineMediatorType = (mediatorType: string): TypeMediator => {
    switch (mediatorType) {
        case 'DRIVER': return TypeMediator.DRIVER
        case 'MASTER': return TypeMediator.MASTER
        default: return TypeMediator.DRIVER
    }
}

export const defineTypeSection = (typeSection: string): TypeSECTION => {
    switch (typeSection) {
        case 'COMMON': return TypeSECTION.COMMON
        case 'FOUNDER': return TypeSECTION.FOUNDER
        case 'PRODUCTION': return TypeSECTION.PRODUCTION
        case 'STORAGE': return TypeSECTION.STORAGE
        case 'PARTNER_TOOLS': return TypeSECTION.PARTNER_TOOLS
        case 'CASH': return TypeSECTION.CASH
        case 'BANK': return TypeSECTION.BANK
        case 'PLASTIK': return TypeSECTION.PLASTIK
        default: return TypeSECTION.COMMON
    } 
}

export const defineCarType = (carType: string): CarType => {
    switch (carType) {
        case 'VIP': return CarType.VIP
        case 'OWN': return CarType.OWN
        case 'STRANGER': return CarType.STRANGER
        default: return CarType.OWN
    } 
}

export const defineProductionType = (productionType: string): ProductionType => {
    switch (productionType) {
        case 'PB_PLITA': return ProductionType.PB_PLITA
        case 'PK_PLITA': return ProductionType.PK_PLITA
        case 'BETON': return ProductionType.BETON
        case 'OTHER': return ProductionType.OTHER
        default: return ProductionType.OTHER
    } 
}

export const definePriceClass = (priceClass: string): PriceClass => {
    switch (priceClass) {
        case 'A': return PriceClass.A
        case 'B': return PriceClass.B
        case 'C': return PriceClass.C
        default: return PriceClass.A
    }
}

export const showPereodicsListWindow = (id:number|undefined, referenceName:string, valueName:string, valueNameTranslate:string, setMainData: Function | undefined) => {
    if (setMainData) {
        setMainData('showPereodicsListWindow', true);
        setMainData('referenceIdForPereodicsList', id || -1);
        setMainData('referenceNameForPereodicsList', referenceName || '');
        setMainData('valueNameForPereodicsList', valueName || '');   
        setMainData('valueNameTranslateForPereodicsList', valueNameTranslate || '');
    }
}

export const getPereodicValue = async (
  id: number | undefined, 
  name: string, 
  token: string,
  date?: number,
  enterpriseId?: number | null,
): Promise<number> => {
    
    date = date || Date.now();

    try {
        const value = await getPereodicValueForDate(id || -1, name, date, token, enterpriseId);
        return value || 0;
    } catch (error) {
        console.error('Error getting pereodic value:', error);
        return 0;
    }
}
