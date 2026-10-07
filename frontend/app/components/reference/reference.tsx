'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { ReferenceProps } from './reference.props';
import styles from './reference.module.css';
import cn from 'classnames';
import { Button, Input, InputNum} from '@/app/components';
import { ReferenceModel, TypePartners, TypeReference, TypeSECTION, TypeTMZ, CarType, ProductionType, PriceClass, isTmzAttributeDictionaryType, FormworkKind, FORMWORK_KIND_LABELS, FORMWORK_NORM_DEFAULT, FORMWORK_NORM_UNIT } from '../../interfaces/reference.interface';
import { TmzDictionarySelect } from './tmzDictionarySelect/tmzDictionarySelect';
import { TMZ_ATTR_DICTIONARY_TYPE, TMZ_ATTR_ID_FIELD } from './tmzDictionarySelect/tmzDictionaryConfig';
import type { TmzDictionaryAttrField } from './tmzDictionarySelect/tmzDictionarySelect.props';
import { typePartnersList, typeSectionList, typeTMZList, carTypeList, mediatorTypeList, productionTypeList, priceClassList, isSharedDirectoryReferenceType, TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS } from './helpers/reference.constants';
import { useAppContext } from '@/app/context/app.context';
import { Select } from './helpers/reference.components';
import { cancelSubmit, defineTypePartners, defineTypeSection, defineTypeTMZ, defineCarType, defineMediatorType, defineProductionType, definePriceClass, canReplaceTmzArticlePrefixFromGroup, extractTmzArticlePrefixFromGroupLabel, getPereodicValue, onSubmit, showPereodicsListWindow } from './helpers/reference.functions';
import { ReferencesService } from '@/app/service/references/references.service';
import { showMessage } from '@/app/service/common/showMessage';
import { getTypeReference } from '@/app/service/references/getTypeReference';
import { getTypeReferenceByTitle } from '@/app/service/references/getTypeReferenceByTitle';
import { CheckBoxForReference } from './checkBoxForReference/checkBoxForReference';
import { SelectForReferences } from './selectForReferences/selectForReferences';
import { SelectForEnterprises } from './selectForEnterprises/selectForEnterprises';
import { UserRoles } from '@/app/interfaces/user.interface';
import { ImageUpload } from './imageUpload/ImageUpload';
import TmzProductTabs from './tmzProductTabs/TmzProductTabs';
import { WindowControls } from '@/app/components/common/windowControls/windowControls';
import { minimizeReference } from '@/app/service/common/minimizeWindow';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { focusNextFocusable } from '@/app/utils/focusNextFocusable';
import {
  openStreetMapUrl,
  parsePartnerLocationLatLon,
} from '@/app/utils/openStreetMapUrl';
import { buildTmzDisplayName, hasTmzNameParts } from '@/app/utils/buildTmzDisplayName';
import { roundNormaTo4 } from '@/app/utils/norma';
import { formatPhoneInput } from '@/app/utils/phoneFormat';
import {
    normalizePassportNumberInput,
    normalizePassportSeriesInput,
} from './helpers/uzPassport.validation';
import {
    normalizeBankAccountInput,
    normalizeBankMfoInput,
    normalizeInnInput,
} from './helpers/uzLegalEntity.validation';
import { normalizeJshshirInput } from './helpers/uzJshshir.validation';
import {
    canCreateReference,
    canEditReference,
    canUploadReferenceFiles,
    canViewReference,
} from '@/app/utils/referencePermissions';
import { SparklesIcon } from '@heroicons/react/24/outline';

function formatPartnerLocationForDisplay(raw?: string | null): string {
  if (!raw) return '';
  try {
    const o = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown };
    const lat = Number(o.latitude);
    const lon = Number(o.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)} — ${raw}`;
    }
  } catch {
    /* оставляем сырую строку */
  }
  return raw;
}

const truncateToDecimals = (value: number, decimals: number): number => {
    const factor = 10 ** decimals;
    return Math.trunc(value * factor) / factor;
};

const formatSheetMaterialArea = (area: unknown): string => {
    if (area == null || area === '') return '';
    const num = typeof area === 'number' ? area : parseFloat(String(area));
    if (!Number.isFinite(num)) return '';
    return truncateToDecimals(num, 3).toFixed(3);
};

const computeSheetMaterialArea = (
    height: unknown,
    width: unknown,
): number | undefined => {
    const h = typeof height === 'number' ? height : parseFloat(String(height ?? ''));
    const w = typeof width === 'number' ? width : parseFloat(String(width ?? ''));
    if (!Number.isFinite(h) || !Number.isFinite(w)) return undefined;
    return truncateToDecimals((h * w) / 1_000_000, 3);
};

export const Reference = ({ className, mutate, inlineMode, typeReferenceOverride, inlineEntry, inlineSlotKey, ...props }: ReferenceProps) :JSX.Element => {
    const {mainData, setMainData} = useAppContext();
    const {showReferenceWindow, selectedEnterpriseId} = mainData.reference
    // В inline-режиме работаем с записью из props (поддержка вложенных модалок),
    // а не с глобальным mainData.reference.inlineCreation.
    const inlineCreation = inlineMode ? (inlineEntry ?? null) : null;
    const inlineSlot = inlineSlotKey ?? 'reference.inlineCreation';
    const { user } = mainData.users
    const { currentReference } = mainData.reference
    const { contentName } = mainData.document;
    const singleEnterpriseMode = mainData.settings?.singleEnterpriseMode ?? false;
    // В inline-режиме тип справочника фиксируем при первом рендере: иначе при гонке/редком сбросе пропа
    // срабатывает getTypeReference(contentName) для документа → по умолчанию PARTNERS и форма «превращается» в партнёров.
    const frozenInlineTypeRef = useRef<TypeReference | null>(null);
    if (inlineMode && typeReferenceOverride != null && typeReferenceOverride !== undefined) {
        if (frozenInlineTypeRef.current === null) {
            frozenInlineTypeRef.current = typeReferenceOverride;
        }
    } else if (!inlineMode) {
        frozenInlineTypeRef.current = null;
    }
    const typeReference =
        inlineMode && frozenInlineTypeRef.current !== null
            ? frozenInlineTypeRef.current
            : typeReferenceOverride ?? getTypeReference(contentName);
    const isNewReference = inlineMode
        ? (inlineCreation?.referenceId == null)
        : mainData.reference.isNewReference;
    const inlineInstanceId = inlineMode ? inlineCreation?.instanceId : undefined;

    // Определяем enterpriseId для нового справочника
    const defaultEnterpriseId = useMemo(() => {
        if (
            inlineMode &&
            inlineCreation?.defaultEnterpriseId !== undefined
        ) {
            return inlineCreation.defaultEnterpriseId;
        }
        if (isSharedDirectoryReferenceType(typeReference)) {
            return null;
        }
        if (user?.superKassir === true && selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
            return selectedEnterpriseId;
        }
        return user?.enterpriseId ?? null;
    }, [
        typeReference,
        user?.superKassir,
        user?.enterpriseId,
        selectedEnterpriseId,
        inlineMode,
        // Только inline-форма: иначе открытие/закрытие inlineCreation пересчитывает defaultBody
        // родительской карточки ТМЗ и сбрасывает несохранённый черновик.
        inlineMode ? inlineCreation?.defaultEnterpriseId : null,
    ]);

    const defaultBody: ReferenceModel = useMemo(() => {
        const tmzDefaults = typeReference === TypeReference.TMZ
            ? {
                typeTMZ: TypeTMZ.PRODUCT,
                imagePath: '',
                imagePath2: '',
                imagePath3: '',
                showOnWebsite: false,
                websiteDescription: '',
                productionType: ProductionType.OTHER,
                priceClass: PriceClass.A,
            }
            : {};
        return {
            name: '',
            article: '',
            typeReference,
            parentId: null,
            isFolder: false,
            enterpriseId: defaultEnterpriseId,
            refValues : tmzDefaults,
        };
    }, [typeReference, defaultEnterpriseId]);

    const [body, setBody] = useState<ReferenceModel>(defaultBody)
    const [firstPriceValue, setFirstPriceValue] = useState<number>(0)
    const [secondPriceValue, setSecondPriceValue] = useState<number>(0)
    const [thirdPriceValue, setThirdPriceValue] = useState<number>(0)
    const [articleGenerateLoading, setArticleGenerateLoading] = useState(false)

    const isTmzDictType = isTmzAttributeDictionaryType(typeReference);

    useEffect(() => {
        if (!inlineMode || !isNewReference || !isTmzDictType) return;
        setBody({
            ...defaultBody,
            enterpriseId: inlineCreation?.defaultEnterpriseId ?? defaultEnterpriseId,
            refValues: {
                ...defaultBody.refValues,
                ...(inlineCreation?.defaultRefValues ?? {}),
            },
        });
    }, [
        inlineMode,
        isNewReference,
        isTmzDictType,
        inlineCreation?.instanceId,
        defaultBody,
        defaultEnterpriseId,
        inlineCreation?.defaultRefValues,
        inlineCreation?.defaultEnterpriseId,
    ]);

    const setTmzDictionaryAttr = useCallback(
        (attr: TmzDictionaryAttrField, id: number | null, text: string) => {
            const idKey = TMZ_ATTR_ID_FIELD[attr] as keyof ReferenceModel['refValues'];
            setBody((state: ReferenceModel) => ({
                ...state,
                refValues: {
                    ...state.refValues,
                    [idKey]: id ?? undefined,
                    [attr]: text,
                },
            }));
        },
        [],
    );
    
    // Проверка прав доступа
    const isAdmin = user?.role === UserRoles.ADMINGLOBAL
    const isHeadGlobal = user?.role === UserRoles.HEADGLOBAL
    const isGlavbuxOrHeadCompany = user?.role === UserRoles.GLAVBUX || user?.role === UserRoles.HEADCOMPANY
    // HEADGLOBAL может редактировать все TMZ (аналогично ADMINGLOBAL)
    const canHeadGlobalEditTMZ = isHeadGlobal && typeReference === TypeReference.TMZ
    const canGlavbuxHeadCompanyEditTMZ = isGlavbuxOrHeadCompany && typeReference === TypeReference.TMZ
    const canDrawingEditTMZ = user?.role === UserRoles.DRAWING && typeReference === TypeReference.TMZ
    const canCreateByPerm = canCreateReference(user, typeReference);
    const canEditByPerm = canEditReference(user, typeReference);
    const canViewByPerm = canViewReference(user, typeReference);
    const canUploadByPerm = canUploadReferenceFiles(user, typeReference);
    const canSave = isNewReference ? canCreateByPerm : canEditByPerm;
    const permBlocksEdit = !canSave;
    const hasCustomReferencePermissions = user?.referencePermissions != null;
    const isTMZReadOnly =
        typeReference === TypeReference.TMZ &&
        (permBlocksEdit ||
            (!isNewReference &&
                !hasCustomReferencePermissions &&
                !isAdmin &&
                !canHeadGlobalEditTMZ &&
                !canGlavbuxHeadCompanyEditTMZ &&
                !canDrawingEditTMZ))
    const isStoragesReadOnly =
        typeReference === TypeReference.STORAGES &&
        (permBlocksEdit || (!isNewReference && !isAdmin))
    const isFormReadOnly = permBlocksEdit || isTMZReadOnly || isStoragesReadOnly
    const canShowParentGroup = canSave && !isFormReadOnly
    const canManageParentGroup =
        canShowParentGroup &&
        !(body.typeReference === TypeReference.TMZ && !body.isFolder)

    const storagesUrl = (typeReference === TypeReference.WORKS || typeReference === TypeReference.TMZ) && user?.token
        ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/STORAGES${user?.enterpriseId ? `?enterpriseId=${user.enterpriseId}` : ''}`
        : null;
    const { data: storagesData } = useSWR(storagesUrl, (url) => getDataForSwr(url, user?.token));
    const productionDepts = useMemo(() => {
        if (!storagesData || !Array.isArray(storagesData)) return [];
        return storagesData
            .filter(
                (s: ReferenceModel) => s.refValues?.typeSection === TypeSECTION.PRODUCTION && !s.isFolder && !s.refValues?.markToDeleted
            )
            .sort((a: ReferenceModel, b: ReferenceModel) =>
                (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true, sensitivity: 'base' })
            );
    }, [storagesData]);

    const partnersUrl =
        typeReference === TypeReference.STORAGES &&
        body.refValues?.typeSection === TypeSECTION.PARTNER_TOOLS &&
        user?.token
            ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/PARTNERS`
            : null;
    const { data: partnersData } = useSWR(partnersUrl, (url) => getDataForSwr(url, user?.token));
    const supplierPartners = useMemo(() => {
        if (!partnersData || !Array.isArray(partnersData)) return [];
        return partnersData
            .filter(
                (p: ReferenceModel) =>
                    p.refValues?.typePartners === TypePartners.SUPPLIERS &&
                    !p.isFolder &&
                    !p.refValues?.markToDeleted,
            )
            .sort((a: ReferenceModel, b: ReferenceModel) =>
                (a.name ?? '').localeCompare(b.name ?? '', undefined, {
                    numeric: true,
                    sensitivity: 'base',
                }),
            );
    }, [partnersData]);

    // Фильтруем typePartnersList: DEPARTMENTS виден только для ADMINGLOBAL
    const filteredTypePartnersList = useMemo(() => {
        if (isAdmin) {
            return typePartnersList;
        }
        return typePartnersList.filter(item => item.name !== TypePartners.DEPARTMENTS);
    }, [isAdmin]);

    const changeElements = (e: React.FormEvent<HTMLInputElement | HTMLSelectElement>) => {
        let target = e.currentTarget
        let value = target.value
        let id = target.id
        
        // Для числовых полей преобразуем строку в число (запятая → точка)
        if (id === 'countInBox' || id === 'firstPrice' || id === 'norma' || id === 'productMetr' || id === 'height' || id === 'width' || id === 'formworkNorm') {
            const t = value.replace(/\s/g, '').replace(',', '.').trim();
            const numValue = t === '' ? NaN : Number(t);
            if (isNaN(numValue)) {
                value = '';
            } else if (id === 'norma') {
                value = String(roundNormaTo4(numValue));
            } else {
                value = numValue.toString();
            }
        }
        
        if (id == 'typeTMZ') value = value ? defineTypeTMZ(value) : value
        if (id == 'typePartners') value = value ? defineTypePartners(value) : value
        if (id == 'typeSection') value = value ? defineTypeSection(value) : value
        if (id == 'carType') value = value ? defineCarType(value) : value
        if (id == 'mediatorType') value = value ? defineMediatorType(value) : value
        if (id == 'productionType') value = value ? defineProductionType(value) : value
        if (id == 'priceClass') value = value ? definePriceClass(value) : value
        if (id === 'phone' || id === 'phone2') {
            value = formatPhoneInput(value);
        }
        if (id === 'passportSeries') {
            value = normalizePassportSeriesInput(value);
        }
        if (id === 'passportNumber') {
            value = normalizePassportNumberInput(value);
        }
        if (id === 'bankAccount') {
            value = normalizeBankAccountInput(value);
        }
        if (id === 'bankMfo') {
            value = normalizeBankMfoInput(value);
        }
        if (id === 'inn') {
            value = normalizeInnInput(value);
        }
        if (id === 'jshshir') {
            value = normalizeJshshirInput(value);
        }

        setBody((state:ReferenceModel) => {
            if (id == 'name' || id == 'article') {
                return {
                    ...state,
                    [id]: value
                }
            } else {
                const nextRefValues: ReferenceModel['refValues'] = {
                    ...state.refValues,
                    [id]: value,
                };
                if ((id === 'height' || id === 'width') && state.refValues?.isSheetMaterial) {
                    const heightVal = id === 'height' ? value : state.refValues?.height;
                    const widthVal = id === 'width' ? value : state.refValues?.width;
                    nextRefValues.area = computeSheetMaterialArea(heightVal, widthVal);
                }
                if (id === 'formworkKind') {
                    const kind = (value || null) as FormworkKind | null;
                    nextRefValues.formworkKind = kind;
                    const isSized =
                        kind === FormworkKind.PANEL ||
                        kind === FormworkKind.CORNER_OUTER ||
                        kind === FormworkKind.CORNER_INNER;
                    if (!isSized) {
                        nextRefValues.height = undefined;
                        nextRefValues.width = undefined;
                    }
                    nextRefValues.formworkNorm = kind ? FORMWORK_NORM_DEFAULT[kind] ?? null : null;
                }
                if (id === 'formworkNorm') {
                    nextRefValues.formworkNorm = value === '' ? null : Number(value);
                }
                return {
                    ...state,
                    refValues: nextRefValues,
                }
            }
        })
    }

    const generateTmzArticle = useCallback(async () => {
        const raw = (body.article ?? '').trim();
        const prefixMatch = raw.match(/^[A-Za-z]{2}/);
        if (!prefixMatch) {
            showMessage('Артикул бошидаги 2 та харфни киритинг (масалан MB)', 'error', setMainData);
            return;
        }
        const prefix = prefixMatch[0];
        if (!user?.token) {
            showMessage('Сессия истекла, войдите снова', 'error', setMainData);
            return;
        }
        setArticleGenerateLoading(true);
        try {
            const { article } = await ReferencesService.previewNextTmzArticle(
                user.token,
                prefix,
                body.enterpriseId ?? null,
                body.id,
            );
            setBody((state) => ({ ...state, article }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сформировать артикул';
            showMessage(message, 'error', setMainData);
        } finally {
            setArticleGenerateLoading(false);
        }
    }, [body.article, body.enterpriseId, body.id, user?.token, setMainData]);

    const generateWorksArticle = useCallback(async () => {
        const raw = (body.article ?? '').trim();
        const prefixMatch = raw.match(/^G\d{3}/i);
        if (!prefixMatch) {
            showMessage('Гуруҳни киритинг (масалан G006 ёки G005)', 'error', setMainData);
            return;
        }
        const prefix = prefixMatch[0].toUpperCase();
        if (!user?.token) {
            showMessage('Сессия истекла, войдите снова', 'error', setMainData);
            return;
        }
        setArticleGenerateLoading(true);
        try {
            const { article } = await ReferencesService.previewNextWorksArticle(
                user.token,
                prefix,
                body.enterpriseId ?? null,
                body.id,
            );
            setBody((state) => ({ ...state, article }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Не удалось сформировать артикул';
            showMessage(message, 'error', setMainData);
        } finally {
            setArticleGenerateLoading(false);
        }
    }, [body.article, body.enterpriseId, body.id, user?.token, setMainData]);

    const setCheckbox = (checked: boolean, id: string) => {
        setBody((state:ReferenceModel) => {
            if (id == 'isFolder') {
                return {
                    ...state,
                    [id]: checked
                }
            } else {
                const nextRefValues: ReferenceModel['refValues'] = {
                    ...state.refValues,
                    [id]: checked,
                };
                if (id === 'isMediatorDriver' && checked) {
                    nextRefValues.isMediatorMaster = false;
                }
                if (id === 'isMediatorMaster' && checked) {
                    nextRefValues.isMediatorDriver = false;
                }
                if (id === 'isIndividualPerson' && checked) {
                    nextRefValues.isLegalEntity = false;
                    nextRefValues.bankName = undefined;
                    nextRefValues.bankAccount = undefined;
                    nextRefValues.bankMfo = undefined;
                    nextRefValues.inn = undefined;
                }
                if (id === 'isLegalEntity' && checked) {
                    nextRefValues.isIndividualPerson = false;
                    nextRefValues.passportSeries = undefined;
                    nextRefValues.passportNumber = undefined;
                    nextRefValues.passportIssueDate = undefined;
                    nextRefValues.passportIssuedBy = undefined;
                    nextRefValues.jshshir = undefined;
                }
                if (id === 'isSheetMaterial' && !checked) {
                    nextRefValues.height = undefined;
                    nextRefValues.width = undefined;
                    nextRefValues.area = undefined;
                }
                if (id === 'isIndividualPerson' && !checked) {
                    nextRefValues.passportSeries = undefined;
                    nextRefValues.passportNumber = undefined;
                    nextRefValues.passportIssueDate = undefined;
                    nextRefValues.passportIssuedBy = undefined;
                    nextRefValues.jshshir = undefined;
                }
                if (id === 'isLegalEntity' && !checked) {
                    nextRefValues.bankName = undefined;
                    nextRefValues.bankAccount = undefined;
                    nextRefValues.bankMfo = undefined;
                    nextRefValues.inn = undefined;
                }
                return {
                    ...state,
                    refValues: nextRefValues,
                }
            }
        })
    }

    const setClientForSectionId = (id: number) => {
        setBody((state:ReferenceModel) => {
            return {
                ...state,
                refValues : {
                    ...state.refValues,
                    clientForSectionId : id
                }
            }
        })
    }

    const setParentId = (
        id: number | null,
        body: ReferenceModel,
        selectedFolder?: ReferenceModel | null,
    ) => {
        if (id != null && id == body.id) return
        setBody((state: ReferenceModel) => {
            const next: ReferenceModel = { ...state, parentId: id }
            if (
                typeReference === TypeReference.TMZ &&
                !state.isFolder &&
                canReplaceTmzArticlePrefixFromGroup(state.article) &&
                selectedFolder
            ) {
                const prefix = extractTmzArticlePrefixFromGroupLabel(selectedFolder.name ?? '')
                if (prefix) {
                    next.article = prefix
                }
            }
            return next
        })
    }

    const setEnterpriseId = (id: number | null) => {
        setBody((state:ReferenceModel) => {
            return {
                ...state,
                enterpriseId : id
            }
        })
    }

    const setGalleryImage = useCallback((slot: 1 | 2 | 3, imagePath: string) => {
        const field = slot === 1 ? 'imagePath' : slot === 2 ? 'imagePath2' : 'imagePath3';
        setBody((state: ReferenceModel) => ({
            ...state,
            refValues: {
                ...state.refValues,
                [field]: imagePath,
            },
        }));
    }, []);

    useEffect(()=> {
        if (inlineMode) return;
        // Не затираем форму при открытой карточке: иначе inline-создание реквизитов или смена
        // организации сбрасывает несохранённые refValues (в т.ч. новый ТМЗ).
        if (showReferenceWindow) {
            if (isNewReference) return;
            if (currentReference != null) return;
        }
        setBody(defaultBody);
    }, [mainData.window.clearControlElements, defaultBody, selectedEnterpriseId, inlineMode, showReferenceWindow, isNewReference, currentReference])

    useEffect(()=> {
        if (body.typeReference == TypeReference.TMZ && body.refValues?.typeTMZ == TypeTMZ.PRODUCT) {
            // Проверяем, нужно ли обновление, чтобы избежать бесконечного цикла
            if (body.refValues?.typeTMZ !== TypeTMZ.PRODUCT) {
                setBody((state:ReferenceModel) => {
                    return {
                        ...state,
                        refValues: {
                            ...state.refValues,
                            typeTMZ: TypeTMZ.PRODUCT
                        }
                    }
                })
            }
        }   
    }, [body.typeReference, body.refValues?.typeTMZ])

    useEffect(() => {
        if (typeReference !== TypeReference.TMZ || body.isFolder) return;
        const parts = { ...body.refValues, typeTMZ: body.refValues?.typeTMZ };
        if (!hasTmzNameParts(parts)) return;
        const next = buildTmzDisplayName(parts);
        if (next !== body.name) {
            setBody((s) => ({ ...s, name: next }));
        }
    }, [
        typeReference,
        body.isFolder,
        body.refValues?.typeTMZ,
        body.refValues?.shortName,
        body.refValues?.shortNameId,
        body.refValues?.size,
        body.refValues?.sizeId,
        body.refValues?.color,
        body.refValues?.colorId,
        body.refValues?.texture,
        body.refValues?.textureId,
        body.refValues?.manufacture,
        body.refValues?.manufactureId,
        body.refValues?.unit,
        body.refValues?.unitId,
    ]);

    // Гидратация формы только при смене выбранной карточки / режима.
    // Не подписываемся на весь mainData.reference — иначе любой апдейт контекста
    // перезаписывает body и стирает несохранённые поля (например filesFromScaling после загрузки файлов).
    useEffect(() => {
        const isInlineEdit = inlineMode && inlineCreation?.referenceId != null;
        if (inlineMode && !isInlineEdit) return;
        if (!inlineMode && isNewReference) return;

        const { currentReference } = mainData.reference;
        if (currentReference == null) return;
        if (isInlineEdit && currentReference.id !== inlineCreation?.referenceId) return;
        if (
            currentReference.typeReference &&
            currentReference.typeReference !== typeReference
        ) {
            return;
        }

        const refValues = typeReference === TypeReference.TMZ
            ? {
                typeTMZ: TypeTMZ.PRODUCT,
                imagePath: '',
                imagePath2: '',
                imagePath3: '',
                showOnWebsite: false,
                websiteDescription: '',
                ...currentReference.refValues,
            }
            : {
                ...currentReference.refValues,
            };

        const newBody: ReferenceModel = {
            ...currentReference,
            typeReference: getTypeReferenceByTitle(currentReference.typeReference),
            refValues,
        };
        setBody(newBody);
    }, [currentReference, inlineMode, inlineCreation?.referenceId, isNewReference, typeReference])

    const reloadPeriodicPrices = useCallback(async () => {
        if (!body.id || !user?.token) return;
        const enterpriseId = user?.enterpriseId;
        try {
            const [first, second, third] = await Promise.all([
                getPereodicValue(body.id, 'firstPrice', user.token, undefined, enterpriseId),
                getPereodicValue(body.id, 'secondPrice', user.token, undefined, enterpriseId),
                getPereodicValue(body.id, 'thirdPrice', user.token, undefined, enterpriseId),
            ]);
            setFirstPriceValue(first);
            setSecondPriceValue(second);
            setThirdPriceValue(third);
        } catch (error) {
            console.error('Error loading periodic prices:', error);
            setFirstPriceValue(0);
            setSecondPriceValue(0);
            setThirdPriceValue(0);
        }
    }, [body.id, user?.token, user?.enterpriseId]);

    useEffect(() => {
        void reloadPeriodicPrices();
    }, [reloadPeriodicPrices]);

    useEffect(() => {
        if (!body.id || !user?.token || mainData.pereodic.showPereodicsListWindow) return;
        const timeoutId = setTimeout(() => void reloadPeriodicPrices(), 500);
        return () => clearTimeout(timeoutId);
    }, [
        mainData.pereodic.showPereodicsListWindow,
        mainData.pereodic.updateDataForPereodicsList,
        reloadPeriodicPrices,
    ]);


    const handleClose = () => {
        if (!setMainData) return
        setMainData('clearControlElements', true);
        if (inlineMode) {
            setMainData(inlineSlot, null);
        } else {
            setMainData('showReferenceWindow', false )
            setMainData('isNewReference', false )
        }
    }

    const handleMinimize = () => {
        if (!setMainData || inlineMode) return;
        minimizeReference(mainData, setMainData);
    };

    const referenceBoxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeReference !== TypeReference.TMZ || body.isFolder || isTMZReadOnly) return;
        if (!inlineMode && !showReferenceWindow) return;

        const frameId = requestAnimationFrame(() => {
            if (!TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS) return;
            const el = referenceBoxRef.current?.querySelector<HTMLInputElement>('#shortName');
            if (el && !el.disabled) {
                el.focus();
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, [
        typeReference,
        body.isFolder,
        body.id,
        showReferenceWindow,
        inlineMode,
        isNewReference,
        isTMZReadOnly,
    ]);

    const handleEnterFocusNext = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.defaultPrevented) return;
        const container = referenceBoxRef.current;
        if (!container) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!container.contains(target)) return;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
            return;
        }
        if (focusNextFocusable(container, target)) {
            e.preventDefault();
        }
    }, []);

    if (
        !inlineMode &&
        ((isNewReference && !canCreateByPerm) || (!isNewReference && !canViewByPerm))
    ) {
        return (
            <div
                className={cn(styles.referenceBox, {
                    [styles.boxClose]: !showReferenceWindow,
                })}
            >
                <WindowControls onClose={handleClose} />
                <p style={{ padding: '16px', color: '#b91c1c' }}>
                    Ушбу справочник учун рухсатингиз йўқ.
                </p>
                <div className={styles.boxBtn}>
                    <Button appearance="ghost" onClick={handleClose}>
                        Бекор килиш
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={referenceBoxRef}
            onKeyDown={handleEnterFocusNext}
            className={cn(styles.referenceBox, 
            {[styles.newReference] : isNewReference},
            {[styles.boxClose] : !inlineMode && !showReferenceWindow})}>
            {!inlineMode && (
                <WindowControls onMinimize={handleMinimize} onClose={handleClose} />
            )}
            <Input
                label={isTmzDictType ? 'Қиймат' : 'Номи'}
                value={body.name}
                type="text"
                id='name'
                className={styles.input}
                onChange={(e)=>changeElements(e)}
                disabled={isTMZReadOnly || (typeReference === TypeReference.TMZ && !body.isFolder)}
                readOnly={typeReference === TypeReference.TMZ && !body.isFolder}
                autoFocus={isNewReference && !(typeReference === TypeReference.TMZ && !body.isFolder)}
            />
            {isTmzDictType &&
                typeReference === TypeReference.TMZ_SHORT_NAME &&
                inlineCreation?.defaultRefValues?.typeTMZ == null && (
                <div className={styles.box}>
                    {Select(typeTMZList, body, 'ТМБ тури', 'typeTMZ', changeElements, false)}
                </div>
            )}
            {typeReference === TypeReference.TMZ && !body.isFolder && (
                <p className={styles.tmzNameHint}>
                    Номи қисқа ном, ўлчам, ранг ва ишлаб чиқарувчидан автоматик шаклланади
                </p>
            )}
            {
                isAdmin &&
                isSharedDirectoryReferenceType(typeReference) &&
                !isNewReference &&
                <SelectForEnterprises 
                    label='Корхона (справочник учун)' 
                    currentEnterpriseId={body.enterpriseId} 
                    setEnterpriseId={setEnterpriseId}
                    isNewReference={isNewReference}
                />
            }
            {
                typeReference == TypeReference.PARTNERS && 
                <div className={styles.box}>
                    {Select(filteredTypePartnersList, body, 'Хамкор тури', 'typePartners', changeElements)}
                    <div className={styles.personTypeRow}>
                        <CheckBoxForReference
                            label="Физ.лицо"
                            setCheckbox={setCheckbox}
                            checked={body.refValues?.isIndividualPerson}
                            id="isIndividualPerson"
                        />
                        <CheckBoxForReference
                            label="Юр.лицо"
                            setCheckbox={setCheckbox}
                            checked={body.refValues?.isLegalEntity}
                            id="isLegalEntity"
                        />
                    </div>
                    {Boolean(body.refValues?.importedFromXlsx) && (
                        <div className={styles.importedFromExcelNote}>
                            Импортирован из Excel
                        </div>
                    )}
                    {Boolean(body.refValues?.isIndividualPerson) && (
                        <>
                            <div className={styles.phoneRow}>
                                <Input
                                    label={'Паспорт серия'}
                                    value={body.refValues?.passportSeries || ''}
                                    type="text"
                                    id="passportSeries"
                                    placeholder="AA"
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                />
                                <Input
                                    label={'Паспорт номер'}
                                    value={body.refValues?.passportNumber || ''}
                                    type="text"
                                    id="passportNumber"
                                    placeholder="1234567"
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                />
                            </div>
                            <div className={styles.phoneRow}>
                                <Input
                                    label={'Дата выдачи паспорта'}
                                    value={
                                        body.refValues?.passportIssueDate
                                            ? String(body.refValues.passportIssueDate).slice(0, 10)
                                            : ''
                                    }
                                    type="date"
                                    id="passportIssueDate"
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                />
                                <Input
                                    label={'Кем выдан'}
                                    value={body.refValues?.passportIssuedBy || ''}
                                    type="text"
                                    id="passportIssuedBy"
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                />
                            </div>
                            <Input
                                label={'ЖШШИР'}
                                value={body.refValues?.jshshir || ''}
                                type="text"
                                id="jshshir"
                                placeholder="14 рақам"
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                            />
                        </>
                    )}
                    {Boolean(body.refValues?.isLegalEntity) && (
                        <>
                        <div className={styles.tripleRow}>
                            <Input
                                label={'Банк'}
                                value={body.refValues?.bankName || ''}
                                type="text"
                                id="bankName"
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                            />
                            <Input
                                label={'Расчётный счёт'}
                                value={body.refValues?.bankAccount || ''}
                                type="text"
                                id="bankAccount"
                                placeholder="20 рақам"
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                            />
                            <Input
                                label={'МФО'}
                                value={body.refValues?.bankMfo || ''}
                                type="text"
                                id="bankMfo"
                                placeholder="00000"
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                            />
                        </div>
                        <Input
                            label={'ИНН'}
                            value={body.refValues?.inn || ''}
                            type="text"
                            id="inn"
                            placeholder="9 рақам"
                            className={styles.input}
                            onChange={(e) => changeElements(e)}
                        />
                        </>
                    )}
                    <Input 
                        label={'Адрес'} 
                        value={body.refValues?.address || ''} 
                        type="text" 
                        id='address' 
                        className={styles.input} 
                        onChange={(e)=>changeElements(e)}
                    />
                    <div className={styles.checkboxRow}>
                        <CheckBoxForReference
                            label="Хайдовчи"
                            setCheckbox={setCheckbox}
                            checked={body.refValues?.isMediatorDriver}
                            id="isMediatorDriver"
                        />
                        <CheckBoxForReference
                            label="Уста"
                            setCheckbox={setCheckbox}
                            checked={body.refValues?.isMediatorMaster}
                            id="isMediatorMaster"
                        />
                    </div>
                    <div className={styles.phoneRow}>
                        <Input
                            label={'Телефон 1'}
                            value={body.refValues?.phone || ''}
                            type="text"
                            id='phone'
                            placeholder='+998-__-___-__-__'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                        />
                        <Input
                            label={'Контактное лицо 1'}
                            value={body.refValues?.contactName1 || ''}
                            type="text"
                            id='contactName1'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                        />
                    </div>
                    <div className={styles.phoneRow}>
                        <Input
                            label={'Телефон 2'}
                            value={body.refValues?.phone2 || ''}
                            type="text"
                            id='phone2'
                            placeholder='+998-__-___-__-__'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                        />
                        <Input
                            label={'Контактное лицо 2'}
                            value={body.refValues?.contactName2 || ''}
                            type="text"
                            id='contactName2'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                        />
                    </div>
                    <div className={styles.phoneRow}>
                        <Input
                            label={'Telegram ID'}
                            value={body.refValues?.telegramId || ''}
                            type="text"
                            id='telegramId'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                        />
                        <Input
                            label={'Локация (Telegram, фақат кўриш)'}
                            value={formatPartnerLocationForDisplay(body.refValues?.location)}
                            type="text"
                            id="telegramLocationReadonly"
                            className={styles.input}
                            readOnly
                            onChange={() => {}}
                        />
                    </div>
                    {(() => {
                      const pos = parsePartnerLocationLatLon(body.refValues?.location);
                      if (!pos) return null;
                      return (
                        <a
                          href={openStreetMapUrl(pos.lat, pos.lon)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.osmLink}
                        >
                          Харитада кўриш (OpenStreetMap)
                        </a>
                      );
                    })()}
                </div>
            }

            {
                !singleEnterpriseMode &&
                isAdmin && 
                (body.refValues?.typePartners === TypePartners.DEPARTMENTS || body.typeReference === TypeReference.STORAGES) &&
                <SelectForEnterprises 
                    label='Корхона' 
                    currentEnterpriseId={body.enterpriseId} 
                    setEnterpriseId={setEnterpriseId}
                    isNewReference={isNewReference}
                />
            }

            {
                typeReference == TypeReference.CARS && 
                <div className={styles.box}>
                    <Input 
                        label={'Модель авто'} 
                        value={body.refValues?.carModel || ''} 
                        type="text" 
                        id='carModel' 
                        className={styles.input} 
                        onChange={(e)=>changeElements(e)}
                    />
                    
                    {Select(carTypeList, body, 'Автомобил тури', 'carType', changeElements)}
                    
                    <InputNum 
                        label={'Норма расхода топлива'} 
                        value={body.refValues?.norma || ''} 
                        id='norma' 
                        className={styles.input} 
                        onChange={(e)=>changeElements(e)}
                    />
                </div>
            }

            {
                typeReference == TypeReference.WORKS &&
                <div className={styles.box}>
                    <div className={styles.articleFieldRow}>
                        <Input
                            label={'Артикул'}
                            value={body.article || ''}
                            type="text"
                            id='article'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                            maxLength={15}
                        />
                        <button
                            type="button"
                            className={styles.articleGenerateBtn}
                            title="Сформировать"
                            aria-label="Сформировать артикул"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void generateWorksArticle();
                            }}
                            disabled={articleGenerateLoading}
                        >
                            {articleGenerateLoading ? (
                                <span aria-hidden="true">…</span>
                            ) : (
                                <SparklesIcon className={styles.articleGenerateBtnIcon} aria-hidden="true" />
                            )}
                        </button>
                    </div>
                    <InputNum
                        label={'Норма'}
                        value={body.refValues?.norma || ''}
                        id='norma'
                        className={styles.input}
                        onChange={(e)=>changeElements(e)}
                        maximumFractionDigits={4}
                    />
                    <Input
                        label={'Ед. изм.'}
                        value={body.refValues?.unit || ''}
                        type="text"
                        id='unit'
                        className={styles.input}
                        onChange={(e)=>changeElements(e)}
                    />
                    <div className={styles.input}>
                        <div className={styles.label}>Цех</div>
                        <select
                            className={styles.select}
                            value={body.refValues?.workDeptId ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                setBody((state: ReferenceModel) => ({
                                    ...state,
                                    refValues: {
                                        ...state.refValues,
                                        workDeptId: val ? Number(val) : undefined,
                                    }
                                }));
                            }}
                        >
                            <option value="">— Цех танланмаган —</option>
                            {productionDepts.map((d: ReferenceModel) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            }

            {
                typeReference == TypeReference.COMMON_WORKS &&
                <div className={styles.box}>
                    <Input
                        label={'Ед. изм.'}
                        value={body.refValues?.unit || ''}
                        type="text"
                        id='unit'
                        className={styles.input}
                        onChange={(e)=>changeElements(e)}
                    />
                    {!isNewReference && body.id ? (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Цена за единицу'}
                                value={firstPriceValue}
                                id='firstPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(
                                            body.id,
                                            body.name,
                                            'firstPrice',
                                            'Цена за единицу',
                                            setMainData,
                                        );
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    ) : (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
                            Сақлагандан сўнг нархни «Тарих» орқали киритиш мумкин.
                        </div>
                    )}
                </div>
            }

            {
                typeReference == TypeReference.TMZ &&  !body.isFolder && 
                <div className={
                    (user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.HEADCOMPANY) 
                        ? styles.boxTMZWithPrice 
                        : styles.boxTMZ
                }> 
                    {Select(typeTMZList, body, 'ТМБ тури', 'typeTMZ', changeElements, isTMZReadOnly)}
                    <TmzDictionarySelect
                        attrField="shortName"
                        dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.shortName}
                        label="Қисқа ном"
                        valueId={body.refValues?.shortNameId}
                        valueText={body.refValues?.shortName}
                        enterpriseId={body.enterpriseId}
                        typeTMZ={body.refValues?.typeTMZ}
                        disabled={isTMZReadOnly}
                        className={styles.tmzDictSelect}
                        onChange={(id, text) => setTmzDictionaryAttr('shortName', id, text)}
                    />
                    {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                        <Input
                            label={'Қисқа ном (текст, текширув)'}
                            value={body.refValues?.shortName || ''}
                            type="text"
                            id="shortName"
                            className={styles.input}
                            onChange={(e) => changeElements(e)}
                            disabled={isTMZReadOnly}
                        />
                    )}
                    {body.refValues?.typeTMZ !== TypeTMZ.OS && (
                        <>
                            <TmzDictionarySelect
                                attrField="size"
                                dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.size}
                                label="Ўлчам"
                                valueId={body.refValues?.sizeId}
                                valueText={body.refValues?.size}
                                enterpriseId={body.enterpriseId}
                                typeTMZ={body.refValues?.typeTMZ}
                                disabled={isTMZReadOnly}
                                className={styles.tmzDictSelect}
                                onChange={(id, text) => setTmzDictionaryAttr('size', id, text)}
                            />
                            {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                                <Input label={'Ўлчам (текст)'} value={body.refValues?.size || ''} type="text" id="size" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                            )}
                            <TmzDictionarySelect
                                attrField="color"
                                dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.color}
                                label="Ранг"
                                valueId={body.refValues?.colorId}
                                valueText={body.refValues?.color}
                                enterpriseId={body.enterpriseId}
                                typeTMZ={body.refValues?.typeTMZ}
                                disabled={isTMZReadOnly}
                                className={styles.tmzDictSelect}
                                onChange={(id, text) => setTmzDictionaryAttr('color', id, text)}
                            />
                            {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                                <Input label={'Ранг (текст)'} value={body.refValues?.color || ''} type="text" id="color" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                            )}
                            <TmzDictionarySelect
                                attrField="texture"
                                dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.texture}
                                label="Текстура"
                                valueId={body.refValues?.textureId}
                                valueText={body.refValues?.texture}
                                enterpriseId={body.enterpriseId}
                                typeTMZ={body.refValues?.typeTMZ}
                                disabled={isTMZReadOnly}
                                className={styles.tmzDictSelect}
                                onChange={(id, text) => setTmzDictionaryAttr('texture', id, text)}
                            />
                            {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                                <Input label={'Текстура (текст)'} value={body.refValues?.texture || ''} type="text" id="texture" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                            )}
                            <TmzDictionarySelect
                                attrField="manufacture"
                                dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.manufacture}
                                label="Ишлаб чиқарувчи"
                                valueId={body.refValues?.manufactureId}
                                valueText={body.refValues?.manufacture}
                                enterpriseId={body.enterpriseId}
                                typeTMZ={body.refValues?.typeTMZ}
                                disabled={isTMZReadOnly}
                                className={styles.tmzDictSelect}
                                onChange={(id, text) => setTmzDictionaryAttr('manufacture', id, text)}
                            />
                            {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                                <Input label={'Ишлаб чиқарувчи (текст)'} value={body.refValues?.manufacture || ''} type="text" id="manufacture" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                            )}
                        </>
                    )}
                    {body.refValues?.typeTMZ === TypeTMZ.OS && (
                        <>
                            <TmzDictionarySelect
                                attrField="texture"
                                dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.texture}
                                label="Текстура"
                                valueId={body.refValues?.textureId}
                                valueText={body.refValues?.texture}
                                enterpriseId={body.enterpriseId}
                                typeTMZ={body.refValues?.typeTMZ}
                                disabled={isTMZReadOnly}
                                className={styles.tmzDictSelect}
                                onChange={(id, text) => setTmzDictionaryAttr('texture', id, text)}
                            />
                            {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                                <Input label={'Текстура (текст)'} value={body.refValues?.texture || ''} type="text" id="texture" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                            )}
                        </>
                    )}
                    <TmzDictionarySelect
                        attrField="unit"
                        dictionaryType={TMZ_ATTR_DICTIONARY_TYPE.unit}
                        label="Улчов бирлиги"
                        valueId={body.refValues?.unitId}
                        valueText={body.refValues?.unit}
                        enterpriseId={body.enterpriseId}
                        typeTMZ={body.refValues?.typeTMZ}
                        disabled={isTMZReadOnly}
                        className={styles.tmzDictSelect}
                        onChange={(id, text) => setTmzDictionaryAttr('unit', id, text)}
                    />
                    {TMZ_CARD_SHOW_ATTRIBUTE_TEXT_FIELDS && (
                        <Input label={'Улчов бирлиги (текст)'} value={body.refValues?.unit || ''} type="text" id="unit" className={styles.input} onChange={(e) => changeElements(e)} disabled={isTMZReadOnly} />
                    )}
                    {
                        canShowParentGroup &&
                        <SelectForReferences
                            type='parent'
                            label='Кайси гурухга киради'
                            referenceId={body.id}
                            typeReference={body.typeReference}
                            currentItemId={body.parentId}
                            setClientForSectionId={(id, folder) => setParentId(id, body, folder)}
                            isNewReference={isNewReference}
                            disabled={isFormReadOnly}
                        />
                    }
                    <div className={styles.articleFieldRow}>
                        <Input
                            label={'АРТИКУЛ'}
                            value={body.article || ''}
                            type="text"
                            id='article'
                            className={styles.input}
                            onChange={(e)=>changeElements(e)}
                            maxLength={15}
                            disabled={isTMZReadOnly}
                        />
                        <button
                            type="button"
                            className={styles.articleGenerateBtn}
                            title="Сформировать"
                            aria-label="Сформировать артикул"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void generateTmzArticle();
                            }}
                            disabled={isTMZReadOnly || articleGenerateLoading}
                        >
                            {articleGenerateLoading ? (
                                <span aria-hidden="true">…</span>
                            ) : (
                                <SparklesIcon className={styles.articleGenerateBtnIcon} aria-hidden="true" />
                            )}
                        </button>
                    </div>
                    {body.refValues?.typeTMZ === TypeTMZ.PRODUCT && (
                        <>
                            {Select(priceClassList, body, 'Класс цен', 'priceClass', changeElements, isTMZReadOnly)}
                            <div style={{ gridColumn: '1 / -1' }} />
                        </>
                    )}
                    {body.refValues?.typeTMZ === TypeTMZ.MATERIAL && (
                        <>
                        <CheckBoxForReference
                            label="Листовой материал"
                            setCheckbox={setCheckbox}
                            checked={Boolean(body.refValues?.isSheetMaterial)}
                            id="isSheetMaterial"
                            disabled={isTMZReadOnly}
                        />
                        {Boolean(body.refValues?.isSheetMaterial) && (
                            <>
                                <InputNum
                                    label={'Высота'}
                                    value={body.refValues?.height ?? ''}
                                    id='height'
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                    disabled={isTMZReadOnly}
                                />
                                <InputNum
                                    label={'Ширина'}
                                    value={body.refValues?.width ?? ''}
                                    id='width'
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                    disabled={isTMZReadOnly}
                                />
                                <InputNum
                                    label={'Площадь (м²)'}
                                    value={formatSheetMaterialArea(body.refValues?.area)}
                                    id='area'
                                    className={styles.input}
                                    onChange={() => {}}
                                    disabled={true}
                                    readOnly={true}
                                />
                            </>
                        )}
                        <div style={{ width: '100%', gridColumn: '1 / -1' }}>
                            <div>Ишлаб чиқариш цехлари</div>
                            <div
                                className={cn(styles.productionDeptList, {
                                    [styles.productionDeptListReadOnly]: isTMZReadOnly,
                                })}
                            >
                                {productionDepts.length === 0 && (
                                    <div className={styles.productionDeptEmpty}>
                                        PRODUCTION цехлар топилмади
                                    </div>
                                )}
                                {productionDepts.map((item: ReferenceModel) => {
                                    const isChecked = body.refValues?.allowedProductionDeptIds?.includes(item.id || 0) || false;
                                    return (
                                        <div
                                            key={item.id}
                                            className={cn(styles.productionDeptItem, {
                                                [styles.productionDeptItemReadOnly]: isTMZReadOnly,
                                            })}
                                            onClick={() => {
                                                if (isTMZReadOnly) return;
                                                const currentIds = body.refValues?.allowedProductionDeptIds || [];
                                                const newIds = isChecked
                                                    ? currentIds.filter((id) => id !== item.id)
                                                    : [...currentIds, item.id || 0];
                                                setBody((state: ReferenceModel) => ({
                                                    ...state,
                                                    refValues: {
                                                        ...state.refValues,
                                                        allowedProductionDeptIds: newIds.length > 0 ? newIds : null,
                                                    },
                                                }));
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isTMZReadOnly}
                                                onChange={() => {
                                                    const currentIds = body.refValues?.allowedProductionDeptIds || [];
                                                    const newIds = isChecked
                                                        ? currentIds.filter((id) => id !== item.id)
                                                        : [...currentIds, item.id || 0];
                                                    setBody((state: ReferenceModel) => ({
                                                        ...state,
                                                        refValues: {
                                                            ...state.refValues,
                                                            allowedProductionDeptIds: newIds.length > 0 ? newIds : null,
                                                        },
                                                    }));
                                                }}
                                                style={{ marginRight: '8px', cursor: isTMZReadOnly ? 'default' : 'pointer' }}
                                            />
                                            <label title={item.name}>{item.name}</label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        </>
                    )}
                    {body.refValues?.typeTMZ === TypeTMZ.OS && (
                        <>
                            <InputNum
                                label={'Амортизация коэффициенти (йиллик %)'}
                                value={body.refValues?.amortizationCoefficient ?? ''}
                                id='amortizationCoefficient'
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                                disabled={isTMZReadOnly}
                            />
                            <Input
                                label={'Амортизация бошланиш санаси'}
                                value={
                                    body.refValues?.amortizationStartDate
                                        ? String(body.refValues.amortizationStartDate).slice(0, 10)
                                        : ''
                                }
                                type="date"
                                id='amortizationStartDate'
                                className={styles.input}
                                onChange={(e) => changeElements(e)}
                                disabled={isTMZReadOnly}
                            />
                        </>
                    )}
                    
                    
                    { false &&
                        ( user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.HEADCOMPANY || user?.role == UserRoles.GLAVBUX) &&        
                        <InputNum 
                            label={'Сотиш нархи'} 
                            value={body.refValues?.firstPrice} 
                            id='firstPrice' 
                            className={styles.input} 
                            onChange={(e)=>changeElements(e)}
                            disabled={isTMZReadOnly}
                        />
                    }
                    
                    {/* Поля для типа продукции и метража */}
                    {
                        body.refValues?.typeTMZ == TypeTMZ.PRODUCT &&
                        <>
                            {/* Метраж показываем только для ПБ Плита */}
                            {
                                body.refValues?.productionType === ProductionType.PB_PLITA &&
                                <InputNum 
                                    label={'Метраж (м)'} 
                                    value={body.refValues?.productMetr || ''} 
                                    id='productMetr' 
                                    className={styles.input} 
                                    onChange={(e)=>changeElements(e)}
                                    disabled={isTMZReadOnly}
                                    placeholder="Укажите метраж для расчета ЗП"
                                />
                            }
                        </>
                    }

                </div>
            }

            {
                typeReference == TypeReference.TMZ &&
                body.refValues?.typeTMZ == TypeTMZ.PRODUCT &&
                !body.isFolder &&
                (
                    <TmzProductTabs
                        body={body}
                        setBody={setBody}
                        token={user?.token}
                        isReadOnly={isTMZReadOnly}
                        canUploadFiles={canUploadByPerm}
                    />
                )
            }

            {
                typeReference == TypeReference.TMZ && !body.isFolder &&
                !isNewReference && body.id &&
                (body.refValues?.typeTMZ === TypeTMZ.TOVAR ||
                    body.refValues?.typeTMZ === TypeTMZ.PRODUCT ||
                    body.refValues?.typeTMZ === TypeTMZ.HALFSTUFF ||
                    body.refValues?.typeTMZ === TypeTMZ.TOOLS) && (
                <div className={`${
                    (user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.HEADCOMPANY)
                        ? styles.boxTMZWithPrice
                        : styles.boxTMZ
                } ${styles.tmzPriceBlock}`}>
                    {/* Сотиш нархи — для TOVAR, периодический firstPrice */}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOVAR && (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Сотиш нархи'}
                                value={firstPriceValue}
                                id='firstPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'firstPrice', 'Сотиш нархи', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    )}
                    {/* Биринчи нарх — для PRODUCT, HALFSTUFF */}
                    {
                        (body.refValues?.typeTMZ === TypeTMZ.PRODUCT || body.refValues?.typeTMZ === TypeTMZ.HALFSTUFF) && (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Диллер'}
                                value={firstPriceValue}
                                id='firstPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'firstPrice', 'Диллер', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    )}
                    {/* Соатлик тариф (часовой тариф аренды) — только для TOOLS, периодический firstPrice */}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS && (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Соатлик тариф (ижара)'}
                                value={firstPriceValue}
                                id='firstPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'firstPrice', 'Соатлик тариф', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    )}
                    {/* Соатлик тариф по перечислению — TOOLS, периодический thirdPrice */}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS && (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Соатлик тариф (перечисление)'}
                                value={thirdPriceValue}
                                id='thirdPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'thirdPrice', 'Соатлик тариф (перечисление)', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    )}
                    {/* Соатлик тариф партнёра (субаренда) — TOOLS, периодический secondPrice */}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS && (
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Соатлик тариф (ҳамкор / субаренда)'}
                                value={secondPriceValue}
                                id='secondPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'secondPrice', 'Ҳамкор тарифи', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                    )}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS && (
                        <div className={styles.checkBoxs}>
                            <CheckBoxForReference
                                label="Субаренда ускунаси"
                                setCheckbox={setCheckbox}
                                checked={Boolean(body.refValues?.isSubleaseTool)}
                                id="isSubleaseTool"
                                disabled={isTMZReadOnly}
                            />
                        </div>
                    )}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS && (
                        <>
                            <div>
                                <div className={styles.label}>Опалубка элементи</div>
                                <select
                                    className={styles.select}
                                    id="formworkKind"
                                    value={body.refValues?.formworkKind ?? ''}
                                    onChange={(e) => changeElements(e)}
                                    disabled={isTMZReadOnly}
                                >
                                    <option value="">— Опалубка эмас —</option>
                                    {Object.values(FormworkKind).map((kind) => (
                                        <option key={kind} value={kind}>
                                            {FORMWORK_KIND_LABELS[kind]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {(body.refValues?.formworkKind === FormworkKind.PANEL ||
                              body.refValues?.formworkKind === FormworkKind.CORNER_OUTER ||
                              body.refValues?.formworkKind === FormworkKind.CORNER_INNER) && (
                                <>
                                    <InputNum
                                        label={
                                            body.refValues?.formworkKind === FormworkKind.PANEL
                                                ? 'Қалқон эни, мм'
                                                : 'Бурчак елкаси, мм'
                                        }
                                        value={body.refValues?.width ?? ''}
                                        id='width'
                                        className={styles.input}
                                        onChange={(e) => changeElements(e)}
                                        disabled={isTMZReadOnly}
                                    />
                                    <InputNum
                                        label={'Баландлиги, мм'}
                                        value={body.refValues?.height ?? ''}
                                        id='height'
                                        className={styles.input}
                                        onChange={(e) => changeElements(e)}
                                        disabled={isTMZReadOnly}
                                    />
                                </>
                            )}
                            {(body.refValues?.formworkKind === FormworkKind.LOCK ||
                              body.refValues?.formworkKind === FormworkKind.BRACE ||
                              body.refValues?.formworkKind === FormworkKind.TIE) && (
                                <InputNum
                                    label={`Норма (${FORMWORK_NORM_UNIT[body.refValues.formworkKind] ?? ''})`}
                                    value={body.refValues?.formworkNorm ?? ''}
                                    id='formworkNorm'
                                    className={styles.input}
                                    onChange={(e) => changeElements(e)}
                                    disabled={isTMZReadOnly}
                                />
                            )}
                        </>
                    )}
                    {/* Иккинчи нарх, Учинчи нарх — только для PRODUCT */}
                    {
                        body.refValues?.typeTMZ === TypeTMZ.PRODUCT && (
                        <>
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Чакана'}
                                value={secondPriceValue}
                                id='secondPricePeriodicDisplay'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'secondPrice', 'Чакана', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                        <div className={styles.priceSection}>
                            <InputNum
                                label={'Перечисление'}
                                value={thirdPriceValue}
                                id='thirdPrice'
                                className={styles.input}
                                disabled={true}
                                readOnly={true}
                            />
                            <button
                                type="button"
                                className={styles.pereodicButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (body.id && setMainData) {
                                        showPereodicsListWindow(body.id, body.name, 'thirdPrice', 'Перечисление', setMainData);
                                    }
                                }}
                                style={{ pointerEvents: 'auto', zIndex: 10 }}
                            >
                                📅 Тарих
                            </button>
                        </div>
                        </>
                    )}
                </div>
                )
            }

            {/* Загрузка изображений ТМЗ: до 3 фото для готовой продукции (каталог) и для материала/полуфабриката */}
            {
                canUploadByPerm &&
                typeReference == TypeReference.TMZ && body.refValues?.typeTMZ == TypeTMZ.PRODUCT &&
                <div className={styles.imageUploadSection}>
                    <div className={styles.catalogWebsiteSection}>
                        <div className={styles.productGalleryRow}>
                            <ImageUpload
                                label="1-сурат (асосий)"
                                currentImage={body.refValues?.imagePath}
                                onImageChange={(p) => setGalleryImage(1, p)}
                                className={styles.imageUpload}
                                disabled={isTMZReadOnly}
                            />
                            <ImageUpload
                                label="2-сурат"
                                currentImage={body.refValues?.imagePath2}
                                onImageChange={(p) => setGalleryImage(2, p)}
                                className={styles.imageUpload}
                                disabled={isTMZReadOnly}
                            />
                            <ImageUpload
                                label="3-сурат"
                                currentImage={body.refValues?.imagePath3}
                                onImageChange={(p) => setGalleryImage(3, p)}
                                className={styles.imageUpload}
                                disabled={isTMZReadOnly}
                            />
                        </div>
                        <CheckBoxForReference
                            label='Каталогда сайтда кўрсатиш (mebers.../catalog)'
                            setCheckbox={setCheckbox}
                            checked={Boolean(body.refValues?.showOnWebsite)}
                            id={'showOnWebsite'}
                            disabled={isTMZReadOnly}
                        />
                        <label className={styles.websiteDescLabel} htmlFor="websiteDescription">Сайт учун тавсиф / хусусиятлар</label>
                        <textarea
                            id="websiteDescription"
                            className={styles.websiteTextarea}
                            rows={6}
                            value={body.refValues?.websiteDescription ?? ''}
                            onChange={(e) => {
                                const v = e.target.value;
                                setBody((state: ReferenceModel) => ({
                                    ...state,
                                    refValues: { ...state.refValues, websiteDescription: v },
                                }));
                            }}
                            disabled={isTMZReadOnly}
                            placeholder="Масалан: ўлчамлар, материал, ранг…"
                        />
                    </div>
                </div>
            }
            {
                canUploadByPerm &&
                typeReference == TypeReference.TMZ && body.refValues?.typeTMZ != TypeTMZ.PRODUCT &&
                <div className={styles.imageUploadSection}>
                    <div className={styles.productGalleryRow}>
                        <ImageUpload
                            label="1-сурат (асосий)"
                            currentImage={body.refValues?.imagePath}
                            onImageChange={(p) => setGalleryImage(1, p)}
                            className={styles.imageUpload}
                            disabled={isTMZReadOnly}
                        />
                        <ImageUpload
                            label="2-сурат"
                            currentImage={body.refValues?.imagePath2}
                            onImageChange={(p) => setGalleryImage(2, p)}
                            className={styles.imageUpload}
                            disabled={isTMZReadOnly}
                        />
                        <ImageUpload
                            label="3-сурат"
                            currentImage={body.refValues?.imagePath3}
                            onImageChange={(p) => setGalleryImage(3, p)}
                            className={styles.imageUpload}
                            disabled={isTMZReadOnly}
                        />
                    </div>
                    {
                        !body.isFolder &&
                        body.refValues?.typeTMZ === TypeTMZ.TOOLS &&
                        <div className={styles.catalogWebsiteSection}>
                            <CheckBoxForReference
                                label='Сайтда кўрсатиш (mebers.../tools)'
                                setCheckbox={setCheckbox}
                                checked={Boolean(body.refValues?.showOnWebsite)}
                                id={'showOnWebsite'}
                                disabled={isTMZReadOnly}
                            />
                            <label className={styles.websiteDescLabel} htmlFor="websiteDescriptionTools">Сайт учун тавсиф / хусусиятлар</label>
                            <textarea
                                id="websiteDescriptionTools"
                                className={styles.websiteTextarea}
                                rows={6}
                                value={body.refValues?.websiteDescription ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setBody((state: ReferenceModel) => ({
                                        ...state,
                                        refValues: { ...state.refValues, websiteDescription: v },
                                    }));
                                }}
                                disabled={isTMZReadOnly}
                                placeholder="Масалан: қувват, ўлчам, ишлаш шароити…"
                            />
                        </div>
                    }
                </div>
            }

            {
                user?.role == UserRoles.ADMINGLOBAL && 
                body.typeReference == TypeReference.STORAGES && 
                <div className={styles.box}> 
                    {
                        !body.isFolder &&
                        <Input
                            label={'Артикул'}
                            value={body.article || ''}
                            type="text"
                            id="article"
                            className={styles.input}
                            onChange={(e) => changeElements(e)}
                            maxLength={15}
                            disabled={isStoragesReadOnly}
                        />
                    }
                    {
                        Select(typeSectionList, body, 'Булим тури', 'typeSection', changeElements, isStoragesReadOnly)
                    }
                    {
                        body.refValues?.typeSection === TypeSECTION.PARTNER_TOOLS &&
                        <div className={styles.input}>
                            <div className={styles.label}>Ҳамкор (субаренда)</div>
                            <select
                                className={styles.select}
                                value={body.refValues?.partnerId ?? ''}
                                disabled={isStoragesReadOnly}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setBody((state: ReferenceModel) => ({
                                        ...state,
                                        refValues: {
                                            ...state.refValues,
                                            partnerId: val ? Number(val) : undefined,
                                        },
                                    }));
                                }}
                            >
                                <option value="">— Ҳамкор танланмаган —</option>
                                {supplierPartners.map((p: ReferenceModel) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    }
                    {/* Организация задаётся через SelectForEnterprises выше (body.enterpriseId) */}
                </div>
            }

            <div className={styles.checkBoxs}>
                {
                    user?.role == UserRoles.ADMINGLOBAL && 
                    body.typeReference == TypeReference.CHARGES &&
                    <CheckBoxForReference label='Ойлик харажат' setCheckbox={setCheckbox} checked={body.refValues.longCharge} id={'longCharge'}/>
                }

                { 
                    user?.role == UserRoles.ADMINGLOBAL && 
                    body.typeReference == TypeReference.STORAGES && 
                    body.refValues.typeSection == TypeSECTION.CASH &&
                    <CheckBoxForReference label='Валюта х.р' setCheckbox={setCheckbox} checked={body.refValues.isForeign} id={'isForeign'}/>
                }

                { 
                    !singleEnterpriseMode &&
                    user?.role == UserRoles.ADMINGLOBAL && 
                    body.typeReference == TypeReference.STORAGES &&
                    <CheckBoxForReference 
                        label='Автоматический прием межпредприятийных документов' 
                        setCheckbox={setCheckbox} 
                        checked={body.refValues.autoAcceptInterEnterprise || false} 
                        id={'autoAcceptInterEnterprise'}
                    />
                }

                { 
                    !singleEnterpriseMode &&
                    user?.role == UserRoles.ADMINGLOBAL && 
                    body.typeReference == TypeReference.STORAGES &&
                    (body.refValues.typeSection == TypeSECTION.CASH || body.refValues.typeSection == TypeSECTION.BANK || body.refValues.typeSection == TypeSECTION.PLASTIK) &&
                    <CheckBoxForReference 
                        label='Офисная касса (может получать деньги от клиентов других организаций)' 
                        setCheckbox={setCheckbox} 
                        checked={body.refValues.isOffice || false} 
                        id={'isOffice'}
                    />
                }

                { 
                    !singleEnterpriseMode &&
                    user?.role == UserRoles.ADMINGLOBAL && 
                    body.typeReference == TypeReference.STORAGES &&
                    body.refValues?.typeSection == TypeSECTION.COMMON &&
                    <CheckBoxForReference 
                        label='Отдельная касса и отдельная бухгалтерия' 
                        setCheckbox={setCheckbox} 
                        checked={body.refValues?.hasBuxgalter || false} 
                        id={'hasBuxgalter'}
                    />
                }

                {
                    body.typeReference == TypeReference.STORAGES &&
                    body.refValues?.typeSection == TypeSECTION.STORAGE &&
                    <CheckBoxForReference
                        label='Основной склад'
                        setCheckbox={setCheckbox}
                        checked={body.refValues?.isMainWarehouse || false}
                        id={'isMainWarehouse'}
                        disabled={isStoragesReadOnly}
                    />
                }

                {
                    body.typeReference == TypeReference.STORAGES &&
                    body.refValues?.typeSection == TypeSECTION.STORAGE &&
                    <CheckBoxForReference
                        label='Брак склад'
                        setCheckbox={setCheckbox}
                        checked={body.refValues?.isDefectWarehouse || false}
                        id={'isDefectWarehouse'}
                        disabled={isStoragesReadOnly}
                    />
                }

            </div>

            
            <div className={styles.folderBox}>  
                {
                    !isTmzDictType &&
                    (user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.HEADCOMPANY || user?.role == UserRoles.GLAVBUX || user?.role == UserRoles.HEADGLOBAL) &&
                    <div>
                        <CheckBoxForReference 
                            label='Бу элемент - гурух (папка)' 
                            setCheckbox={setCheckbox} 
                            checked={body.isFolder} 
                            id={'isFolder'}
                            disabled={isTMZReadOnly}
                            // disabled={(!isNewReference && (user?.role == UserRoles.ADMINGLOBAL || user?.role == UserRoles.GLAVBUX)) || !(user?.role == UserRoles.ADMINGLOBAL && body.refValues?.comment !== "I-am-understand-risk")} // ADMINGLOBAL или с кодом понимания риска
                        />

                        {/* {!isNewReference && user?.role !== UserRoles.ADMINGLOBAL && user?.role !== UserRoles.HEADGLOBAL && body.refValues?.comment !== "I-am-understand-risk" && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                Папка статусини Admin узгартириши мумкин, ёкиСтатус папки может изменить только администратор или введите I-am-understand-risk в комментарий
                            </div>
                        )} */}
                    </div>
                }

                {
                    canManageParentGroup &&
                    <SelectForReferences
                        type='parent'
                        label='Кайси гурухга киради'
                        referenceId={body.id}
                        typeReference={body.typeReference}
                        currentItemId={body.parentId}
                        setClientForSectionId={(id, folder) => setParentId(id, body, folder)}
                        isNewReference={isNewReference}
                        disabled={isFormReadOnly}
                    />
                }
            </div>
            
            {
                (body.typeReference == TypeReference.WORKERS ) && 
                <Input label={'Телеграм ID'} value={body.refValues?.telegramId} type="text" id='telegramId' className={styles.input} onChange={(e)=>changeElements(e)}/>
            }


            {body.typeReference !== TypeReference.WORKS && (
                <>
                    <Input label={'Изох'} value={body.refValues?.comment} type="text" id='comment' className={styles.input} onChange={(e)=>changeElements(e)} disabled={isTMZReadOnly}/>
                    {!isNewReference && user?.role !== UserRoles.ADMINGLOBAL && (
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                            💡Папка мақомини ўзгартириш учун изоҳга «I-am-understand-risk» деб ёзинг.
                        </div>
                    )}
                </>
            )}
            
        <div className={styles.boxBtn}>
            {!isFormReadOnly && (
                <Button appearance='primary' onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSubmit(body,
                                body.typeReference || typeReference, 
                                isNewReference,
                                setMainData,
                                user?.token,
                                mutate,
                                inlineInstanceId,
                                inlineMode ? inlineSlot : undefined);
                }}
                    >Саклаш</Button>
            )}
            <Button appearance='ghost' onClick={() => inlineMode ? handleClose() : cancelSubmit(setMainData)}>Бекор килиш</Button>
        </div> 
        
    </div>   
    )
} 