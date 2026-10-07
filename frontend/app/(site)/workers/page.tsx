'use client'
import styles from './page.module.css'
import { useAppContext } from '@/app/context/app.context';
import { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { UserRoles } from '@/app/interfaces/user.interface';
import WorkerWorksJournal from '@/app/components/furnitureOrders/workerWorksJournal/workerWorksJournal';
import WorkerStageJournal from '@/app/components/furnitureOrders/workerStageJournal/workerStageJournal';
import { getStoredUser } from '@/app/service/common/authStorage';

export default function Users() {
  
  const {mainData} = useAppContext();
  const { user } = mainData.users;

  useEffect(() => {
    if (user == undefined && !getStoredUser()) {
      redirect('/');
    }
  }, [user]);

  return (
    <div className={styles.container}>
      {user?.role === UserRoles.PRODUCTION && <WorkerWorksJournal />}
      {(user?.role === UserRoles.SCALING || user?.role === UserRoles.ZAVSKLAD || user?.role === UserRoles.DELIVERY) && (
        <WorkerStageJournal />
      )}
      {user?.role && ![UserRoles.PRODUCTION, UserRoles.SCALING, UserRoles.ZAVSKLAD, UserRoles.DELIVERY].includes(user.role) && (
        <div className={styles.notSupported}>
          Для роли {user.role} новый рабочий интерфейс пока не настроен.
        </div>
      )}
      {!user?.role && (
        <div className={styles.notSupported}>
          Пользователь не найден.
        </div>
      )}
      </div>
  )
}
