'use client'
import { SelectForEnterprisesProps } from './selectForEnterprises.props';
import styles from './selectForEnterprises.module.css';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { Enterprise } from '@/app/interfaces/enterprise.interface';

export const SelectForEnterprises = ({ label, currentEnterpriseId, setEnterpriseId, className, isNewReference, ...props }: SelectForEnterprisesProps): JSX.Element => {
    
    const {mainData} = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const { data } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );

    const value =
        currentEnterpriseId === null || currentEnterpriseId === undefined
            ? 'null'
            : String(currentEnterpriseId);

    const changeElements = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.currentTarget.value;
        setEnterpriseId(v === 'null' ? null : parseInt(v, 10));
    };
    
    return (
        <div className={styles.box}>
            {label !='' && <div className={styles.label}>{label}</div>}
            <select
                className={cn(styles.select, className)}
                value={value}
                {...props}
                onChange={changeElements}
                disabled={props.disabled}
            >   
                <option 
                    value="null"
                    className={styles.chooseMe}
                    key = {-1}
                    >Танланмаган
                </option>
                {data && data.length>0  &&
                data
                .filter((item: Enterprise) => !item.markToDeleted && item.isActive !== false)
                .sort((a: Enterprise, b: Enterprise) => {
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                })
                .map(( item:Enterprise ) => {
                    return (
                    <option 
                        className={styles.option}
                        key = {item.id}
                        value={String(item.id)}
                        data-id={item.id}
                        >
                        {item.name}
                    </option>  
                )}
                )}
            </select>
        </div>
    );
};

