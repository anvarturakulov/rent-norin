import { InfoProps } from "./info.props";
import styles from './info.module.css';

export const Info = ({label, content, className, ...props}: InfoProps): JSX.Element => {
    return (
        <div className={styles.box}>
            <div className={styles.label}>{label}</div>
            <div className={styles.content}>{content}</div>
        </div>
    )
}