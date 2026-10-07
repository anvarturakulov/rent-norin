import { SpinnerProps } from "./spinner.props";
import styles from './spinner.module.css';
import { useAppContext } from '@/app/context/app.context';
import Anime from './animat.gif';
import Loading from './loadingSecond.svg';

export const Spinner = ({className, ...props}: SpinnerProps): JSX.Element => {
    const {mainData, setMainData} = useAppContext()

    return (
        <div className={styles.container}>
            <Loading className={styles.loading}/>
        </div>
    )
}