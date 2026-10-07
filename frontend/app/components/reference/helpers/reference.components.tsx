import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DataForSelect } from './reference.constants'
import styles from '../reference.module.css';

export const  Select = (list: Array<DataForSelect>, body: ReferenceModel,label: string, typeString: string, changeElement: Function, disabled?: boolean) => {
    
  let currentValue = ''
  if (typeString == 'typeTMZ' && body.refValues?.typeTMZ) {
    currentValue = body.refValues?.typeTMZ
  }

  if (typeString == 'typePartners' && body.refValues?.typePartners) {
    currentValue = body.refValues?.typePartners
  }

  if (typeString == 'typeSection' && body.refValues?.typeSection) {
    currentValue = body.refValues?.typeSection
  }

  if (typeString == 'carType' && body.refValues?.carType) {
    currentValue = body.refValues?.carType
  }

  if (typeString == 'productionType' && body.refValues?.productionType) {
    currentValue = body.refValues?.productionType
  }

  if (typeString == 'priceClass' && body.refValues?.priceClass) {
    currentValue = body.refValues?.priceClass
  }

  return (
    <div>
      <div className={styles.label}>{label}</div>
      <select
          className={styles.select}
          onChange={(e) => changeElement(e)}
          id={typeString}
          value={currentValue}
          disabled={disabled}
      >
          {list.map((elem, i) => {
            return (
                <option
                  value={elem.name}
                  // defaultValue={elem.name}
                  // selected = { elem.name == currentValue ? true : false}
                  key = {i}
                >
                  {elem.title}
                </option>
            );
          })}
      </select>

    </div>
  )
}
