'use client'
import { SectionProps } from './section.props';
import styles from './section.module.css';
import { SectionItem } from './sectionItem/sectionItem';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';

export const Section = ({className, data, sectionType, currentSection, ...props }: SectionProps) :JSX.Element => {
    const enterpriseName = useEnterpriseName();
    let title 
    if (sectionType == 'delivery') title = 'ЮК ЕТКАЗУВЧИЛАР'
    if (sectionType == 'filial') title = 'ЦЕХЛАР'
    if (sectionType == 'buxgalter') title = 'КАССА КАРТОЧКА'
    if (sectionType == 'founder') title = 'ТАЪСИСЧИЛАР'

    let datas = data ? data.filter((item: any) => item?.reportType == `SECTION-${sectionType.toLocaleUpperCase()}`)[0]?.values : []

    return (
       <>
            <div className={styles.title}>
                {title}
                {enterpriseName && <span> - {enterpriseName}</span>}
            </div>
            <div className={styles.itemsBox}>
                {
                    datas && datas.length &&
                    datas
                    .filter((item:any) => {
                        if (currentSection) return currentSection == item.sectionId
                        return true
                    })
                    .map((element: any, key: number) => {
                        return <SectionItem 
                            key={key}
                            item={element}
                            sectionType={sectionType}
                        />
                    })
                }  
            </div>
       </>
    )
} 