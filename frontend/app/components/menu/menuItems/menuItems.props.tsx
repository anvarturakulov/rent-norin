import { MenuItem } from "../../../interfaces/menu.interface";
import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface MenuItemsProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    menuData: Array<MenuItem>,
    isCollapsed?: boolean,
    isExpanded?: boolean,
    onMenuItemClick?: () => void,
    onSubItemClick?: () => void,
}