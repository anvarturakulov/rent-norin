'use client'
import { SkladItemProps } from './skladItem.props';
import styles from './skladItem.module.css';
import { Htag } from '@/app/components';
import { numberValue } from '@/app/service/common/converters';

export const SkladItem = ({className, item, ...props }: SkladItemProps) :JSX.Element => {
    
    // Логирование для диагностики
    console.log('SkladItem received item:', item);
    console.log('Materials:', item?.materials);
    console.log('Products:', item?.products);
    
    // Объединяем материалы и продукты в один массив для отображения
    const allItems = [
        ...(item?.materials || []).map((material: any) => ({ ...material, type: 'Материал' })),
        ...(item?.products || []).map((product: any) => ({ ...product, type: 'Продукт' }))
    ];
    
    console.log('All items combined:', allItems);
    
    return (
       <>
          <div className={styles.item}>
            <Htag tag='h1'>{item?.section}</Htag>
            
            {/* Секция материалов */}
            {item?.materials && item.materials.length > 0 && (
              <div className={`${styles.section} ${styles.sectionMaterials}`}>
                <Htag tag='h2' className={styles.h2}>Хом ашёлар</Htag>
                {item.materials.map((element:any, key:number) => {
                    const value = element?.value
                    const price = element?.price
                    const valueSum = element?.valueSum
                    const bag = element?.bag

                    return (
                        <div className={styles.row} key={`material-${key}`}>
                            <div className={styles.title}>{element?.name}</div>
                            <div className={styles.value}>{numberValue(+value)}</div>
                            <div className={styles.value}><span>{bag ? `(${bag})`: ''}</span></div>
                            <div className={styles.value}>{numberValue(+price)}</div>
                            <div className={styles.value}>{numberValue(+valueSum)}</div>
                        </div>
                    )
                })}
                
                {/* Итого по материалам */}
                <div className={`${styles.row} ${styles.totalRow} ${styles.totalRowMaterials}`} key="materials-total">
                    <div className={styles.totalTitle}>Материаллар жами</div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.total}>{
                        numberValue(item.materials.reduce((acc:any, item:any) => {
                            return acc + (item.valueSum || 0)}, 0))
                        }
                    </div>
                </div>
              </div>
            )}
            
            {/* Секция готовой продукции */}
            {item?.products && item.products.length > 0 && (
              <div className={`${styles.section} ${styles.sectionProducts}`}>
                <Htag tag='h2' className={styles.h2}>Тайёр махсулотлар</Htag>
                {item.products.map((element:any, key:number) => {
                    const value = element?.value
                    const price = element?.price
                    const valueSum = element?.valueSum
                    const bag = element?.bag

                    return (
                        <div className={styles.row} key={`product-${key}`}>
                            <div className={styles.title}>{element?.name}</div>
                            <div className={styles.value}>{numberValue(+value)}</div>
                            <div className={styles.value}><span>{bag ? `(${bag})`: ''}</span></div>
                            <div className={styles.value}>{numberValue(+price)}</div>
                            <div className={styles.value}>{numberValue(+valueSum)}</div>
                        </div>
                    )
                })}
                
                {/* Итого по готовой продукции */}
                <div className={`${styles.row} ${styles.totalRow} ${styles.totalRowProducts}`} key="products-total">
                    <div className={styles.totalTitle}>Тайёр махсулот жами</div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.total}>{
                        numberValue(item.products.reduce((acc:any, item:any) => {
                            return acc + (item.valueSum || 0)}, 0))
                        }
                    </div>
                </div>
              </div>
            )}
            
            {/* Общий итог */}
            {(item?.materials?.length > 0 || item?.products?.length > 0) && (
                <div className={`${styles.row} ${styles.totalRow} ${styles.grandTotal}`} key="grand-total">
                    <div className={styles.totalTitle}>УМУМИЙ ЖАМИ</div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.value}></div>
                    <div className={styles.total}>{
                        numberValue(allItems.reduce((acc:any, item:any) => {
                            return acc + (item.valueSum || 0)}, 0))
                        }
                    </div>
                </div>
            )}
            
            {/* Показываем сообщение, если нет данных */}
            {(!item?.materials?.length && !item?.products?.length) && (
                <div className={styles.emptyState}>
                    <div className={styles.title}>Маълумот йўқ</div>
                </div>
            )}
            
          </div>
      </>
    )
} 