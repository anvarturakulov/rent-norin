import { SelectForReferencesProps } from './selectForReferences.props';
import styles from './selectForReferences.module.css';
import { useAppContext } from '@/app/context/app.context';
import useSWR from 'swr';
import cn from 'classnames';
import { ReferenceModel, TypeReference, TypeSECTION } from '@/app/interfaces/reference.interface';
import { Maindata } from '@/app/context/app.context.interfaces';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import { sortByName } from '@/app/service/references/sortByName';

export const SelectForReferences = ({ label, typeReference ,currentItemId, setClientForDeliveryId, className, ...props }: SelectForReferencesProps): JSX.Element => {
    
    const {mainData, setMainData} = useAppContext();
    const { user } = mainData.users;
    const token = user?.token;
    const url = process.env.NEXT_PUBLIC_DOMAIN+'/api/reference/byType/'+typeReference;
    const { data, mutate } = useSWR(url, (url) => getDataForSwr(url, token));

    const changeElements = (e: React.FormEvent<HTMLSelectElement>, setMainData: Function | undefined, mainData: Maindata) => {
        let target = e.currentTarget;
        let id = target[target.selectedIndex].getAttribute('data-id');
        setClientForDeliveryId(id)
    }
    
    return (
        <div className={styles.box}>
            {label !='' && <div className={styles.label}>{label}</div>}
            <select
                className={cn(styles.select)}
                {...props}
                onChange={(e) => changeElements(e, setMainData, mainData)}
            >   
                <>
                    <option 
                        value={'Танланмаган'} 
                        data-type={null} 
                        data-id={null}
                        className={styles.chooseMe}
                        selected = {true}
                        
                        >{'=>'}</option>
                </>
                {data && data.length>0  &&
                data
                .filter((item: ReferenceModel)=> {
                    return ( 
                        // DELIVERY and FILIAL are not in TypeSECTION enum, using COMMON as fallback
                        item.refValues?.typeSection == TypeSECTION.COMMON
                    )
                })
                .sort(sortByName)
                .filter(( item:ReferenceModel ) => !item.refValues?.markToDeleted )
                .map(( item:ReferenceModel ) => (
                    <>
                        <option 
                            className={styles.option}
                            key = {item.id}
                            value={item.name}
                            data-type={item.typeReference} 
                            data-id={item.id}
                            selected={item.id == currentItemId} 
                            >
                                {item.name}
                        </option>  
                    </>
                ))}
            </select>
        </div>
    );
};
