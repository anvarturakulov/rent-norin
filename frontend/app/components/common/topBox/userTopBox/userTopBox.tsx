'use client'
import styles from './userTopBox.module.css'
import cn from 'classnames';
import {UserTopBoxProps} from './userTopBox.props';
import { useAppContext } from '@/app/context/app.context';
import UserIco from './ico/user.svg';

export default function UserTopBox({className, ...props}:UserTopBoxProps):JSX.Element {
    
  const {mainData, setMainData} = useAppContext()
  const { user } = mainData.users
  const exit = ( setMaindata: Function | undefined ) => {
    setMainData && setMainData('user', undefined);
    setMainData && setMainData('mainPage', true);
  }

  return (
    <div className={styles.user}
      onClick={() => exit(setMainData)}
      >
      <div className={styles.ico}>
        <UserIco/>
      </div>
      <div className={styles.title}>
        {user?.name}
      </div>
    </div> 
  )
}
