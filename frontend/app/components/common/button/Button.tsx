import { ButtonProps } from "./Button.props";
import styles from './Button.module.css';
import cn from 'classnames';

export const Button = ({ appearance, children, className, disabled, ...props }: ButtonProps): JSX.Element => {
    return (
        <button
            className={cn(styles.button, className, {
                [styles.primary]: appearance == 'primary',
                [styles.ghost]: appearance == 'ghost',
                [styles.green]: appearance == 'green',
                [styles.disabled]: disabled == true
            }
            )}
            {...props}
        >
            {children}
        </button>
    )
}

