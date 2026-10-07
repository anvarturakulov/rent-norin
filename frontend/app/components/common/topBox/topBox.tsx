'use client'
import styles from './topBox.module.css'
import cn from 'classnames';
import {TopBoxProps} from './topBox.props';
import Menu from '../../menu/dashboardMenu/menu';
import { useAppContext } from '@/app/context/app.context';
import User from './userTopBox/userTopBox';
import { dashboardUsersList } from '@/app/interfaces/user.interface';

export default function TopBox({className, ...props}:TopBoxProps):JSX.Element {
    
  const {mainData} = useAppContext()
  const {user} = mainData.users
  const showMenu = user && dashboardUsersList.includes(user?.role)
  
  return (
    <div className={cn(styles.topBox, {[styles.topBoxMini] : !showMenu})}>
      {showMenu && <Menu/>}
      <div className={styles.logo}>
       OSON DASTUR
      </div>
      <User/>
    </div>
  )
}
