import { TypeReference } from './reference.interface';

export enum UserRoles {
    ADMINGLOBAL = "ADMINGLOBAL",
    HEADGLOBAL = "HEADGLOBAL",
    KASSIRGLOBAL = "KASSIRGLOBAL",
  
    HEADCOMPANY = "HEADCOMPANY",
    GLAVBUX = "GLAVBUX",
  
    GUEST = "GUEST",
    KASSIR = "KASSIR",
    ZAVSKLAD = "ZAVSKLAD",
    SCALING = "SCALING",
    DRAWING = "DRAWING",
    DELIVERY = "DELIVERY",
    MARKETING = "MARKETING",
    PRODUCTION = "PRODUCTION",
    TEXNOLOG = "TEXNOLOG",
}

export interface TmzTabPermissions {
    works: boolean;
    commonWorks: boolean;
    materials: boolean;
    halfstuffs: boolean;
    components: boolean;
    pricing: boolean;
    techMap: boolean;
    files: boolean;
}

export interface ReferencePermissionItem {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canUploadFiles: boolean;
    tmzTabs?: TmzTabPermissions;
}

export type ReferencePermissions = Partial<Record<TypeReference, ReferencePermissionItem>>;

export interface User {
    id?: number,
    email: string,
    token: string;
    name: string,
    banned?: boolean,
    banReason?: string,
    sectionId?: number,
    telegramId?: string,
    role: UserRoles,
    enterpriseId?: number | null,
    isSuperUser?: boolean,
    allowedStorageIds?: number[] | null,
    superKassir?: boolean,
    referencePermissions?: ReferencePermissions | null,
}

export interface UserModel {
    id?: number,
    email: string,
    password: string,
    name: string,
    banned?: boolean,
    banReason?: string,
    sectionId?: number,
    telegramId?: string,
    role: UserRoles,
    enterpriseId?: number | null,
    allowedStorageIds?: number[] | null,
    superKassir?: boolean,
    referencePermissions?: ReferencePermissions | null,
}

export interface BodyForLogin {
    email: string,
    password: string,
}

export interface UserName {
    id: number,
    name: string,
}

export const dashboardUsersList = [UserRoles.ADMINGLOBAL, UserRoles.HEADGLOBAL, UserRoles.HEADCOMPANY, UserRoles.GUEST, UserRoles.GLAVBUX, UserRoles.KASSIR, UserRoles.KASSIRGLOBAL, UserRoles.ZAVSKLAD, UserRoles.SCALING, UserRoles.DRAWING, UserRoles.DELIVERY, UserRoles.MARKETING, UserRoles.PRODUCTION, UserRoles.TEXNOLOG];
export const workersUsersList: UserRoles[] = [
    UserRoles.PRODUCTION,
    UserRoles.SCALING,
    UserRoles.DELIVERY,
];
export const adminAndHeadCompany = [UserRoles.ADMINGLOBAL, UserRoles.HEADCOMPANY]
