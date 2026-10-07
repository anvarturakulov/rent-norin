import { DocumentType } from "./document.interface"
import { ContentType, ServiceType, GateType } from "./general.interface"
import { TypeReference } from './reference.interface'
import { ReportType } from './report.interface'
import { UserRoles } from "./user.interface"

export interface MenuSubItem {
    title: DocumentType | TypeReference | ServiceType | ReportType | GateType
    description: string,
    type: ContentType,
    active:boolean,
    group?: string, // Добавляем поле группы
    roles?: UserRoles[]; // Роли, которым доступен этот элемент меню
}

export interface MenuSubGroup {
    title: string,
    items: Array<MenuSubItem>
}

export interface MenuItem {
    title: string,
    titleText: string,
    isOpened: boolean,
    subMenu: Array<MenuSubItem>,
    subGroups?: Array<MenuSubGroup> // Добавляем поддержку групп
}
