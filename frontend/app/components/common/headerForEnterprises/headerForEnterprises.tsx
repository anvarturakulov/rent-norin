import styles from './headerForEnterprises.module.css';
import { HeaderForEnterprisesProps } from './headerForEnterprises.props';
import AddIco from './add.svg';
import CloseIco from './close.svg';
import { useAppContext } from '@/app/context/app.context';
import { minimizeEnterprise } from '@/app/service/common/minimizeWindow';
import cn from 'classnames';
import { Maindata } from '@/app/context/app.context.interfaces';

export default function HeaderForEnterprises({ className, ...props }: HeaderForEnterprisesProps): JSX.Element {
    const { mainData, setMainData } = useAppContext();
    const { showEnterpriseWindow, isNewEnterprise } = mainData.enterprises || { showEnterpriseWindow: false, isNewEnterprise: false };
    const strFirst = isNewEnterprise ? 'Янги корхона очиш' : 'Корхоналарни куриш';

    const addNewElement = (setMainData: Function | undefined, mainData: Maindata) => {
        if (setMainData) {
            setMainData('clearControlElements', false);
            setMainData('showEnterpriseWindow', true);
            setMainData('isNewEnterprise', true);
        }
    };

    return (
        <>
            <div className={styles.box}>
                <div className={cn(styles.title,
                    { [styles.newWindow]: isNewEnterprise })}
                >
                    {strFirst}
                </div>

                <div>
                    {showEnterpriseWindow ?
                        <div className={styles.windowActions}>
                            <button
                                type="button"
                                className={styles.minimizeBtn}
                                title="Свернуть"
                                onClick={() => setMainData && minimizeEnterprise(mainData, setMainData)}
                            >
                                &#8212;
                            </button>
                        <CloseIco
                            className={styles.ico}
                            onClick={() => {
                                if (setMainData) {
                                    setMainData('clearControlElements', true);
                                    setMainData('showEnterpriseWindow', false);
                                    setMainData('isNewEnterprise', false);
                                }
                            }}
                        />
                        </div>
                        :
                        <>
                            <AddIco
                                className={styles.ico}
                                onClick={() => addNewElement(setMainData, mainData)}
                            />
                        </>
                    }
                </div>
            </div>
        </>
    );
}

