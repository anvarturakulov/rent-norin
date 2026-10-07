import { SelectPartnerTypeProps } from './selectPartnerType.props';
import styles from './selectPartnerType.module.css';
import { useAppContext } from '@/app/context/app.context';
import { Maindata } from '@/app/context/app.context.interfaces';

export const SelectPartnerType = ({ className, visible = true, ...props }: SelectPartnerTypeProps): JSX.Element => {
    const {mainData, setMainData} = useAppContext();
    
    const changeElements = (e: React.FormEvent<HTMLSelectElement>, setMainData: Function | undefined, mainData: Maindata) => {
        let target = e.currentTarget;
        let partnerType = target[target.selectedIndex].getAttribute('data-type');
        
        let {reportOption} = mainData.report;
        
        let newObj = {
            ...reportOption,
            partnerType: partnerType,
        }
        if (setMainData) {
            setMainData('reportOption', {...newObj})
        }
    }
    
    if (!visible) return <></>;
    
    return (
        <div className={styles.box}>
            <label className={styles.label}>Хамкор тури</label>
            <select
                className={styles.select}
                {...props}
                onChange={(e) => changeElements(e, setMainData, mainData)}
            >   
                <option 
                    value={'Танланмаган'}
                    key={-1}
                    data-type={null} 
                    className={styles.chooseMe}
                    >{'Тангланг =>>>>'}
                </option>
                <option
                    key={1}
                    value={'Клиентлар'}
                    data-type={'CLIENTS'}
                    className={styles.option}
                >
                    Мижозлар
                </option>
                <option
                    key={2}
                    value={'Клиентлар'}
                    data-type={'DEPARTMENTS'}
                    className={styles.option}
                >
                    Булимлар
                </option>
                <option
                    key={3}
                    value={'Таъминловчилар'}
                    data-type={'SUPPLIERS'}
                    className={styles.option}
                >
                    Таъминотчилар
                </option>
            </select>
        </div>
    );
};
