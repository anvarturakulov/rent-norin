import { DataForUserSelect } from './user.constants'
import styles from '../user.module.css';
import { UserModel } from '@/app/interfaces/user.interface';

export const SelectForUser = (list: Array<DataForUserSelect>, body: UserModel,label: string, changeElement: Function) => {
    
  let currentValue = ''
  if (body.role) {
    currentValue = body.role
  }
  
  return (
    <div>
      <div className={styles.label}>{label}</div>
      <select
          className={styles.select}
          onChange={(e) => changeElement(e)}
          id={'role'}
          value={currentValue}
      >
          {list.map((elem, i) => {
            return (
              <option
                value={elem.name}
                key={i}
              >
                {elem.title}
              </option>
            );
          })}
      </select>
    </div>
  )
}
