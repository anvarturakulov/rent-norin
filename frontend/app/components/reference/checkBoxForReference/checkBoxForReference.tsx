import { checkBoxForReferenceProps } from './checkBoxForReference.props';
import styles from './checkBoxForReference.module.css';
import cn from 'classnames';
import { useEffect, useState } from 'react';

export const CheckBoxForReference = ({ className, checked, setCheckbox, label, id, ...props }: checkBoxForReferenceProps): JSX.Element => {
    
    const changeElements = (e: React.FormEvent<HTMLInputElement>, setCheckbox: Function, id: string) => {
        let target = e.currentTarget;
        setCheckbox(target.checked, id)
    }

    const [value, setValue] = useState<boolean>(false);
    useEffect(() => {
        if (checked) setValue(checked)
        else setValue(false)
    }, [checked])


    return (
        <div className={styles.box}>
            <input
                className={cn(className, styles.input)}
                {...props}
                onChange={(e) => changeElements(e, setCheckbox, id)}
                type='checkbox'
                checked={value}
                id={id}
                />
            {label !='' && <label htmlFor={id} className={styles.label}>{label}</label>}
        </div>
    );
};
