import { banUserById } from '@/app/service/users/banUserById';
import { getUserById } from '@/app/service/users/getUserById';

export const banRestoreUser = async (
  id: number | undefined,
  name: string | undefined,
  banned: boolean | undefined,
  setMainData: Function | undefined,
  token: string | undefined 
) => {
  let reason:string = ''
  if (id) {
    const title = banned ? 'Фойдаланувчини тиклашнинг сабаби?': 'Фойдаланувчини чеклаш сабаби' 
    let reason = prompt(title)
    if (reason && reason?.length > 0) {
      await banUserById(id, name, reason, setMainData, token);
      
    }
  }
}

export const getUser = async (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined
) => {
  setMainData && setMainData('isNewUser', false);
  setMainData && setMainData('clearControlElements', false)
  if (id) {
    const user = await getUserById(id, setMainData, token);
  }
  
}