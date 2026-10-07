'use client'
import { useEffect, useState } from 'react';
import { PereodicProps } from './pereodic.props';
import styles from './pereodic.module.css';
import cn from 'classnames';
import { Button, Input} from '@/app/components';
import { useAppContext } from '@/app/context/app.context';
import { cancelSubmit, onSubmit } from './helpers/pereodic.functions';
import { PereodicModel } from '../../interfaces/reference.interface';
import { InputForDatePereodic } from './components/inputForDatePereodic/inputForDatePereodic';

export const Pereodic = ({ className, ...props }: PereodicProps) :JSX.Element => {

    const {mainData, setMainData} = useAppContext();
    const {
        isNewPereodic, 
        showPereodicWindow, 
        currentPereodic, 
    } = mainData.pereodic
    const { user } = mainData.users

    const defaultBody: PereodicModel = {
        id: 0,
        referenceId: 0,
        date: 0,
        name: '',
        value: 0
    }

    const [body, setBody] = useState<PereodicModel>(defaultBody)   

    const changeElements = (e: React.FormEvent<HTMLInputElement>) => {
        let target = e.currentTarget
        let value = target.value
        let id = target.id

        setBody((state:PereodicModel) => {
            return {
                ...state,
                [id]: +value
            }
        })
    }

    useEffect(()=> {
        setBody(defaultBody);
    }, [mainData.window.clearControlElements])

    useEffect(() => {
        const {currentPereodic} = mainData.pereodic
        
        if (currentPereodic != undefined || currentPereodic != null) {
            let newBody: PereodicModel = {
                ...currentPereodic,
                
            }
            setBody(newBody)
        }
    }, [ currentPereodic ])

    return (
        <div className={cn(styles.pereodicBox, 
            {[styles.newPereodic] : isNewPereodic},
            {[styles.boxClose] : !showPereodicWindow})}>

            <p className={styles.formCaption}>
                {isNewPereodic ? 'Янги сана учун қиймат қўшиш' : 'Танланган сана учун қийматни таҳрирлаш'}
            </p>
            <InputForDatePereodic label={'Сана'} id='date'/>
            <Input label={'Киймат'} value={body.value} type="number" id='value' className={styles.input} onChange={(e)=>changeElements(e)}/>
            
            <div className={styles.boxBtn}>
                <Button appearance='primary' onClick={() => 
                    onSubmit(body,
                                isNewPereodic,
                                setMainData,
                                user?.token,
                                user?.enterpriseId)}
                    >Саклаш</Button>
                <Button appearance='ghost' onClick={() => cancelSubmit(setMainData)}>Бекор килиш</Button>
            </div> 
        </div>   
    )
} 