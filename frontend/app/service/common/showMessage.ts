import { EntryItem } from '@/app/interfaces/report.interface';
import { MessageType } from '../../interfaces/general.interface'

export const showMessage = (
  message: string | Array<EntryItem>,
  messageType: MessageType,
  setMainData: Function | undefined) => {

  if (setMainData) {
    setMainData('showMessageWindow', true);
    if (typeof message == 'string') {
      setMainData('message', message);
    } else {
      setMainData('message', [...message]);
    }
    setMainData('messageType', messageType);
  }
}