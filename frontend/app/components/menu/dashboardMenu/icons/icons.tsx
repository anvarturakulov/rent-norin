'use client'
import styles from './icons.module.css'
import {IconsProps} from './icons.props'
import IcoChart from './ico/chart.svg'
import IcoTable from './ico/table.svg'
import IcoCircle from './ico/circle.svg'
import IcoCube from './ico/cube.svg'
import IcoEqual from './ico/equal.svg'
import IcoSettings from './ico/settings.svg'
import IcoFurniture from './ico/furniture.svg'

const ICON_BY_TITLE: Record<string, JSX.Element> = {
    'Асосий натижалар': <IcoCube />,
    'КПП': <IcoTable />,
    'Хужжатлар': <IcoCircle />,
    'Номлар': <IcoChart />,
    'Хисоботлар': <IcoEqual />,
    'Дастур': <IcoSettings />,
    'Мебель ишлаб чиқариш': <IcoFurniture />,
}

export default function Icons({title, className, ...props}:IconsProps):JSX.Element {
    return (
        <div className={styles.icon}>
            {ICON_BY_TITLE[title] ?? null}
        </div>
    )
}
