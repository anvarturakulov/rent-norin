import { InputProps } from './input.props';
import styles from './input.module.css';
import cn from 'classnames';


export const Input = ({ label, visible=true, className, ...props }: InputProps): JSX.Element => {
    
    if (visible == false) return <></>
    let {value, type} = props
    
    if (value == null && type == 'text') value = ''
    if (value == null && type == 'number') value = 0 

    return (
        <div className={styles.box}>
            {label !='' && <div className={styles.label}>{label}</div>}
            <input
                className={cn(className, styles.input)}
                {...props}
                value={value}
            />
        </div>
    );
};
