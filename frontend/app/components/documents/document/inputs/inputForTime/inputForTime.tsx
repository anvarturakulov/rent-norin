import { InputForTimeProps } from './inputForTime.props';
import styles from './inputForTime.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { Maindata } from '@/app/context/app.context.interfaces';
import { adminAndHeadCompany, UserRoles } from '@/app/interfaces/user.interface';
import { formatDateForInput, parseDateInputValue } from '@/app/utils/dateInput';
import { nowMs } from '@/app/utils/serverNow';

export const InputForTime = ({label, id, className, ...props }: InputForTimeProps): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const { currentDocument } = mainData.document;
    const { user } = mainData.users;
    const role = user?.role;
    const isAdminOrHeadCompany = role && adminAndHeadCompany.includes(role)
    
    let dateDoc = currentDocument.date > 0 ? +currentDocument.date : nowMs() 
    
    let currentVal = formatDateForInput(dateDoc)

    const changeElements = (e: React.FormEvent<HTMLInputElement>, setMainData: Function | undefined, mainData: Maindata) => {
        let {currentDocument} = mainData.document;
        let {user} = mainData.users;
        let target = e.currentTarget;
        const role = user?.role;
        let value = target.value;
        const valueDate = parseDateInputValue(value) ?? Date.parse(value)
        let newObj = {}
        if (target.id == 'date') {
            newObj = {
                ...currentDocument,
                date: valueDate,
            }
        }
        
        if (target.id == 'orderTakingDate') {
            newObj = {
                ...currentDocument,
                DocValues: {
                    ...currentDocument.docValues,
                    orderTakingDate: valueDate
                }
            }
        }

        const oneDay = 24 * 60 * 60 * 1000
        const now = nowMs()
        const remainDate = now % oneDay
        const startDateToday = now - remainDate
        const yesterDay = startDateToday - oneDay

        if (role == UserRoles.GLAVBUX && valueDate < yesterDay && target.id == 'date' ) return

        if ( setMainData ) {
            setMainData('currentDocument', {...newObj})
        }
    }

    return (
        <div className={styles.box}>
            {label !='' && <div className={styles.label}>{label}</div>}
            <input
                className={cn(className, styles.input)}
                onChange={(e) => changeElements(e, setMainData, mainData)}
                type='time'
                value={currentVal}
                disabled = {!isAdminOrHeadCompany}
                id = {id}
                {...props}
            />
        </div>
    );
};
