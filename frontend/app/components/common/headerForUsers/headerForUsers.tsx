import styles from './headerForUsers.module.css'
import { HeaderForUsersProps } from './headerForUsers.props'
import AddIco from './add.svg'
import CloseIco from './close.svg'
import { useAppContext } from '@/app/context/app.context';
import { minimizeUser } from '@/app/service/common/minimizeWindow';
import cn from 'classnames';
import { Maindata } from '@/app/context/app.context.interfaces';

export default function HeaderForUser({ className, ...props }: HeaderForUsersProps): JSX.Element {
    
    const {mainData, setMainData} = useAppContext()
    const { showUserWindow, isNewUser } = mainData.users
    const strFirst = isNewUser ? 'Янги фойдаланувчи очиш' : 'Фойдаланувчиларни куриш';

    const addNewElement = (setMainData: Function | undefined, mainData: Maindata) => {
        if (setMainData) {
            setMainData('clearControlElements', false);
            setMainData('showUserWindow', true);
            setMainData('isNewUser' , true);
        }
    }

    return (
        <>
            {
                <div className={styles.box}>
                    <div className={cn(styles.title, 
                                    {[styles.newWindow] : isNewUser})}
                        >{strFirst}
                    </div>
                    
                    <div>
                        { showUserWindow ? 
                        <div className={styles.windowActions}>
                            <button
                                type="button"
                                className={styles.minimizeBtn}
                                title="Свернуть"
                                onClick={() => setMainData && minimizeUser(mainData, setMainData)}
                            >
                                &#8212;
                            </button>
                        <CloseIco 
                            className={styles.ico}
                            onClick={() => {
                                if (setMainData) {
                                    setMainData('clearControlElements', true);
                                    setMainData('showUserWindow', false);
                                    setMainData('isNewUser', false);                                    
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
            }
        </>
    )
}

