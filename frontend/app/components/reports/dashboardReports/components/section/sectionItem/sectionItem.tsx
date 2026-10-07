'use client'
import { SectionItemProps } from './sectionItem.props';
import styles from './sectionItem.module.css';
import cn from 'classnames';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';

export const SectionItem = ({className, item, sectionType, ...props }: SectionItemProps) :JSX.Element => {
    const counts = (item && item.counts && item?.counts.length) ? [...item.counts] : []
    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1'>{item?.section}</Htag>
            {
                ( sectionType != 'buxgalter' && sectionType != 'founder')
                && counts && counts.length &&
                counts
                .map((element: any, key: number) => {
                        return (
                            <div key = {key} className={cn(styles.box, {
                                [styles.greyRow]: (key+3) % 2 !== 0
                            })}>
                                <Htag tag='h2' className={styles.h2}>{element?.name}</Htag>
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Кун бош. колдик</div>
                                    <div>{numberValue(element?.startBalansCountNon)}</div>
                                </div>

                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Ишл. чик. кирим</div>
                                    <div>{numberValue(element?.prodCountNon)}</div>
                                </div>
                                
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Ички силж. кирим</div>
                                    <div>{numberValue(element?.moveIncomeCountNon)}</div>
                                </div>
                                
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Сотилган нон</div>
                                    <div>
                                        {numberValue(element?.saleCountNon)}
                                        <span>
                                            &nbsp;({numberValue(item?.maydaSavdoCount)})
                                        </span> 
                                    </div>
                                </div>
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Заказга берилган нон</div>
                                    <div>
                                        {numberValue(element?.saleCountOrder)}
                                         
                                    </div>
                                </div>
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Брак(истем.) нон</div>
                                    <div>{numberValue(element?.brakCountNon)}</div>
                                </div>
                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Ички сил. чиким</div>
                                    <div>{numberValue(element?.moveOutNon)}</div>
                                </div>

                                <div className={cn(styles.row, styles.rowCount)}>
                                    <div className={styles.title}>Зимм. колдик нон</div>
                                    <div>{numberValue(element?.endBalansCountNon)}</div>
                                </div>
                            </div>
                        ) 
                            
                    })
                
            }
            <div className={styles.sumBox}>
                <Htag tag='h2' className={cn(styles.h2, styles.bottomTitle)}>Пул буйича</Htag>
                <div className={styles.row}>
                    <div className={styles.title}>Бошлангич колдик</div>
                    <div className={styles.value}>{numberValue(item?.startBalansSumma)}</div>
                </div>
                
                <div className={styles.row}>
                    <div className={styles.title}>Пул кирим (мижозлардан)</div>
                    <div className={styles.value}>{numberValue(item?.incomeFromClients)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Пул кирим (ички корхоналардан)</div>
                    <div className={styles.value}>{numberValue(item?.incomeFromDepartments)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Пул силжишдан кирим</div>
                    <div className={styles.value}>{numberValue(item?.moveIncome)}</div>
                </div>

                <div className={styles.row}>
                    <div className={cn(styles.title, styles.totalTitle, styles.blueText)}>ЖАМИ КИРИМ</div>
                    <div className={cn(styles.value, styles.totalValue, styles.blueText)}>{numberValue(item?.allIncome)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Харажатларга берилди</div>
                    <div className={styles.value}>{numberValue(item?.outForCharges)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Таъминотчиларга берилди</div>
                    <div className={styles.value}>{numberValue(item?.outForSuppliers)}</div>
                </div>
                
                <div className={styles.row}>
                    <div className={styles.title}>Ички корхоналарга берилди</div>
                    <div className={styles.value}>{numberValue(item?.outForDepartments)}</div>
                </div>
                
                <div className={styles.row}>
                    <div className={styles.title}>Пул силжиш чиким</div>
                    <div className={styles.value}>{numberValue(item?.moveOut)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Таъсисчига берилди</div>
                    <div className={styles.value}>{numberValue(item?.outForFounder)}</div>
                </div>
                

                <div className={styles.row}>
                    <div className={cn(styles.title, styles.totalTitle, styles.redText)}>ЖАМИ ЧИКИМ</div>
                    <div className={cn(styles.value, styles.totalValue, styles.redText)}>{numberValue(item?.allOut)}</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.title}>Охирги колдик</div> 
                    <div className={styles.value}>{numberValue(item?.endBalansSumma)}</div>
                </div>
            </div>
            
          </div>
      </>
    )
} 