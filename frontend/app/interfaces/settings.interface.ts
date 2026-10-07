export enum SettingType {
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    JSON = 'JSON',
    ARRAY = 'ARRAY',
    DATE = 'DATE'
}

export interface Setting {
    id: number;
    key: string;
    type: SettingType;
    value: string | number | boolean | object | any[] | Date;
    description: string;
    markToDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    allowedRoles?: string[];
    enterpriseId?: number | null;
    enterprise?: {
        id: number;
        name: string;
    } | null;
    isPereodic?: boolean;
}

export interface SettingPereodicModel {
    id?: number;
    settingId: number;
    enterpriseId?: number | null;
    date: number;
    value: number;
}

export interface SettingsCreationAttrs {
    key: string;
    type: SettingType;
    value: string | number | boolean | object | any[] | Date;
    description: string;
    allowedRoles?: string[];
    enterpriseId?: number | null;
    isPereodic?: boolean;
}
