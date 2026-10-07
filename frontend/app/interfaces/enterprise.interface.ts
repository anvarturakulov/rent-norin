import { DocumentType } from './document.interface';
import { ReportType } from './report.interface';
import { TypeReference } from './reference.interface';
import { ServiceType, GateType, FurnitureType } from './general.interface';
import { UserRoles } from './user.interface';

export interface RoleMenuVisibility {
    visibleDocuments?: DocumentType[];
    visibleReports?: ReportType[];
    visibleInformReports?: string[]; // Inform отчеты могут быть строками, не только ReportType
    visibleReferences?: TypeReference[];
    visibleServices?: ServiceType[];
    visibleGates?: GateType[];
    visibleFurniture?: FurnitureType[];
    // Права на документы для глобальных ролей
    canAddDocuments?: boolean;
    canEditDocuments?: boolean;
    canDeleteDocuments?: boolean;
    canProcessDocuments?: boolean;
}

export interface MenuVisibilitySettings {
    [role: string]: RoleMenuVisibility;
}

export interface EnterpriseSettings {
    menuVisibility?: MenuVisibilitySettings;
    [key: string]: any;
}

export interface Enterprise {
    id?: number;
    name: string;
    code: string;
    isActive?: boolean;
    settings?: EnterpriseSettings | null;
    markToDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface EnterpriseModel extends Enterprise {
    id: number;
}

