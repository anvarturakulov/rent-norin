import { Maindata } from '@/app/context/app.context.interfaces';
import { setProvodkaToDocument } from '@/app/service/documents/setProvodkaToDocument'
import { DATE_BAN_EDITING_MESSAGE, isDocumentDateBanned } from '@/app/service/settings/dateBanEditing'

export const setProvodkaByReciever = (
  id: number | undefined,
  proveden: boolean | undefined,
  setMainData: Function | undefined,
  mainData: Maindata,
  docDate?: number,
) => {
  if (isDocumentDateBanned(docDate, mainData.settings?.dateBanEditing)) {
    alert(DATE_BAN_EDITING_MESSAGE)
    return
  }

  if (proveden != undefined && proveden == false) {
    let yes = confirm('Хужжатни кабул киласизми');
    if ( yes ) {
      setProvodkaToDocument(id, setMainData, mainData)
    } 
  }

}
