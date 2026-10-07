import { MenuItem } from '@/app/interfaces/menu.interface';
import { DetailedHTMLProps, HTMLAttributes } from "react";

export interface UserMenuProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    menuData: Array<MenuItem>,
}