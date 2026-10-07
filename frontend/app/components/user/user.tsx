'use client'
import { useEffect, useMemo, useState } from 'react';
import { UserProps } from './user.props';
import styles from './user.module.css';
import cn from 'classnames';
import { Button} from '@/app/components';
import {  userRolesList } from './helpers/user.constants';
import { useAppContext } from '@/app/context/app.context';
import { SelectForUser } from './helpers/user.components';
import { cancelSubmitUser, onSubmitUser } from './helpers/user.functions';
import { ReferencePermissions, UserModel, UserRoles } from '@/app/interfaces/user.interface';
import { ReferencePermissionsEditor } from './referencePermissionsEditor/ReferencePermissionsEditor';
import { getEnterprises } from '@/app/service/enterprises/getEnterprises';
import { TypeReference, ReferenceModel } from '@/app/interfaces/reference.interface';
import { getDataForSwr } from '@/app/service/common/getDataForSwr';
import useSWR from 'swr';

export const User = ({ className, ...props }: UserProps) :JSX.Element => {

    const { mainData, setMainData } = useAppContext();
    const { user } = mainData.users
    const { isNewUser, showUserWindow } = mainData.users
    const singleEnterpriseMode = mainData.settings?.singleEnterpriseMode ?? false;

    const userRolesListFiltered = useMemo(() => {
        if (!singleEnterpriseMode) return userRolesList;
        return userRolesList.filter(
            (item) => item.name !== UserRoles.HEADGLOBAL && item.name !== UserRoles.KASSIRGLOBAL
        );
    }, [singleEnterpriseMode]);

    const token = user?.token;
    const { data: enterprises } = useSWR(
        token ? 'enterprises' : null,
        () => getEnterprises(token)
    );

    // Загружаем список STORAGES для выбора разрешенных storages
    const storagesUrl = token ? `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/byType/${TypeReference.STORAGES}` : null;
    const { data: storages } = useSWR(
        storagesUrl,
        (url) => getDataForSwr(url, token)
    );

    const defaultBody: UserModel = {
        id: 0,
        email: '',
        password: '',
        name: '',
        sectionId: undefined,
        telegramId: '',
        role: UserRoles.GUEST,
        banReason: '',
        banned: false,
        enterpriseId: null,
        allowedStorageIds: null,
        superKassir: false,
        referencePermissions: null,
    }

    const [body, setBody] = useState<UserModel>(defaultBody) 
    
    const changeElements = (e: React.FormEvent<HTMLInputElement>) => {
        let target = e.currentTarget
        setBody((state:UserModel) => {
            return {
                ...state,
                [target.id]: target.type == 'checkbox' ? target.checked : 
                                                         target.id == 'sectionId' ? (target.value === '' ? undefined : +target.value) :
                                                         target.id == 'enterpriseId' ? (target.value === '' ? null : +target.value) :
                                                                                    target.value
            }
        })
    }

    useEffect(()=> {
        setBody(body => (
            { ...defaultBody}
        ));
    }, [mainData.window.clearControlElements])

    useEffect(() => {
        const {currentUser} = mainData.users
        
        if (currentUser != undefined) {
            let newBody: UserModel = {
                ...currentUser
            }
            setBody(newBody)
        }
    }, [mainData.users, mainData.users.currentUser])

    return (
        <div className={cn(styles.referenceBox, 
            {[styles.newReference] : isNewUser},
            {[styles.boxClose] : !showUserWindow})}>
            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Email</div>
                    <input value={body.email} type="text" id='email' className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>

                <div className={styles.nameBox}>
                    <div>Калит суз</div>
                    <input value={body.password} type="text" id='password' className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>
            </div> 
            
            {
                SelectForUser(userRolesListFiltered, body, 'Фойдаланувчи тури', changeElements)
            }
            
            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Исми</div>
                    <input value={body.name} type="text" id='name' className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>
                <div></div>
                {false && (
                <div className={styles.nameBox}>
                    <div>storageId</div>
                    <input 
                        value={body.sectionId || ''} 
                        type="number" 
                        id='sectionId' 
                        className={styles.input} 
                        onChange={(e)=>changeElements(e)}
                        placeholder="Танланмаган"
                    />
                </div>
                )}
                <div className={styles.nameBox}>
                    <div>telegramId</div>
                    <input
                        value={body.telegramId}
                        type="text"
                        id='telegramId'
                        className={styles.input}
                        onChange={(e)=>changeElements(e)}
                        title="Для входа в dashboard нужен Start у бота кодов"
                    />
                </div>
            </div>

            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Корхона</div>
                    <select 
                        value={body.enterpriseId || ''} 
                        id='enterpriseId' 
                        className={styles.input} 
                        onChange={(e) => {
                            const value = e.target.value === '' ? null : Number(e.target.value);
                            setBody((state: UserModel) => ({
                                ...state,
                                enterpriseId: value
                            }));
                        }}
                    >
                        <option value="">Танланмаган</option>
                        {enterprises?.map((enterprise: any) => (
                            <option key={enterprise.id} value={enterprise.id}>
                                {enterprise.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Чеклов куйилганлик белгиси</div>
                    <input type='checkbox' id='banned' checked={body.banned} className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>
                <div className={styles.nameBox}>
                    <div>Чеклов буйича изох</div>
                    <input value={body.banReason} type="text" id='banReason' className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>
            </div>

            {!singleEnterpriseMode && (
            <div className={styles.box}>
                <div className={styles.nameBox}>
                    <div>Суперкасса (позволяет вводить справочники от имени других организаций)</div>
                    <input type='checkbox' id='superKassir' checked={body.superKassir || false} className={styles.input} onChange={(e)=>changeElements(e)}/>
                </div>
            </div>
            )}

            {!singleEnterpriseMode && (
            <div className={styles.box}>
                <div className={styles.nameBox} style={{ width: '100%' }}>
                    <div>Рухсат берилган омборхоналар (межпредприятийные документы учун)</div>
                    <div style={{ 
                        maxHeight: '200px', 
                        overflowY: 'auto', 
                        border: '1px solid #ccc', 
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: '#fff'
                    }}>
                        {storages?.filter((item: ReferenceModel) => !item.refValues?.markToDeleted)
                            .sort((a: ReferenceModel, b: ReferenceModel) => a.name.localeCompare(b.name))
                            .map((item: ReferenceModel) => {
                                const isChecked = body.allowedStorageIds?.includes(item.id || 0) || false;
                                return (
                                    <div key={item.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '5px 0',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        const currentIds = body.allowedStorageIds || [];
                                        let newIds: number[];
                                        if (isChecked) {
                                            newIds = currentIds.filter(id => id !== item.id);
                                        } else {
                                            newIds = [...currentIds, item.id || 0];
                                        }
                                        setBody((state: UserModel) => ({
                                            ...state,
                                            allowedStorageIds: newIds.length > 0 ? newIds : null
                                        }));
                                    }}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            onChange={() => {
                                                const currentIds = body.allowedStorageIds || [];
                                                let newIds: number[];
                                                if (isChecked) {
                                                    newIds = currentIds.filter(id => id !== item.id);
                                                } else {
                                                    newIds = [...currentIds, item.id || 0];
                                                }
                                                setBody((state: UserModel) => ({
                                                    ...state,
                                                    allowedStorageIds: newIds.length > 0 ? newIds : null
                                                }));
                                            }}
                                            style={{ marginRight: '8px', cursor: 'pointer' }}
                                        />
                                        <label style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            {item.name}
                                        </label>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>
            )}

            <ReferencePermissionsEditor
                value={body.referencePermissions}
                onChange={(referencePermissions: ReferencePermissions | null) => {
                    setBody((state: UserModel) => ({
                        ...state,
                        referencePermissions,
                    }));
                }}
            />

        <div className={styles.boxBtn}>
            <Button appearance='primary' onClick={() => 
                onSubmitUser(body, 
                            isNewUser,
                            setMainData,
                            user?.token)}
                >Саклаш</Button>
            <Button appearance='ghost' onClick={() => cancelSubmitUser(setMainData)}>Бекор килиш</Button>
        </div> 
    </div>   
    )
} 