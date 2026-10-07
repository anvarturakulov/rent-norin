import { CheckBoxInFooterProps, ValuesToJournalCheckboxs } from './checkBoxInFooter.props';
import styles from './checkBoxInFooter.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { Maindata } from '@/app/context/app.context.interfaces';
import { defaultJournalCheckbox } from '@/app/context/app.context.helpers.constants';

export const CheckBoxInFooter = ({ className, id, label, ...props }: CheckBoxInFooterProps): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const { journalChechboxs } = mainData.journal;
    
    const changeElements = (e: React.FormEvent<HTMLInputElement>, setMainData: Function | undefined, mainData: Maindata, id: ValuesToJournalCheckboxs) => {
        let target = e.currentTarget;
        let currentValues = {...defaultJournalCheckbox}
        currentValues[id] = target.checked
        if ( setMainData ) {
            setMainData('journalChechboxs', {...currentValues} )
        }
    }

    return (
        <div className={styles.box}>
            <input
                className={cn(className, styles.input)}
                {...props}
                onChange={(e) => changeElements(e, setMainData, mainData, id)}
                type='checkbox'
                checked={journalChechboxs[id]}
                id={id}
                />
            {label !='' && <label htmlFor={id} className={styles.label}>{label}</label>}
        </div>
    );
};
