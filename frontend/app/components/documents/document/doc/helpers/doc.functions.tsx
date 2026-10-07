import { defaultDocument } from '@/app/context/app.context.helpers.constants';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DocumentType } from '@/app/interfaces/document.interface';
import { UserRoles } from '@/app/interfaces/user.interface';
import { formatDisplayDate } from '@/app/utils/formatDisplayDate';

export const saveUser = (setMainData: Function | undefined, mainData: Maindata): any => {
  let {currentDocument} = mainData.document;
  let newObj = {
      ...currentDocument,
      userId: mainData.users.user?.id,
      documentType: mainData.document.contentName as DocumentType
  }

  if ( setMainData ) {
      setMainData('currentDocument', {...newObj})
  }
}

export const saveProvodka = (setMainData: Function | undefined, mainData: Maindata) => {
  let { contentName } = mainData.document;
  let { currentDocument } = mainData.document;
  
  let value = true
  
  if (contentName == DocumentType.LeaveCash || contentName == DocumentType.MoveCash) {
    value = false
  }

  let newObj = {
      ...currentDocument,
      proveden: value,
  }

  if ( setMainData ) {
      setMainData('currentDocument', {...newObj})
  }
}

export const cancelSubmit = (setMainData: Function | undefined, mainData: Maindata) => {
    const {user} = mainData.users
    if (setMainData) {
        const previousContentName = mainData.document.previousContentName;
        const keepHost = mainData.document.keepHostPageOnClose;
        if (previousContentName) {
            setMainData('contentName', previousContentName);
        }
        setMainData('document.previousContentName', undefined);
        setMainData('document.keepHostPageOnClose', false);
        setMainData('clearControlElements', true);
        setMainData('showDocumentWindow', false);
        setMainData('isNewDocument', false);
        setMainData('document.isDuplicateDraft', false);
        setMainData('currentDocument', {...defaultDocument});
        if (
            !keepHost &&
            user?.role != UserRoles.HEADCOMPANY &&
            user?.role != UserRoles.ADMINGLOBAL
        ) {
            setMainData('mainPage', true)
        }
    }
}

export const secondsToDateString = (seconds: number | undefined): String => {
    if (seconds) {
        return formatDisplayDate(+seconds)
    }
    return ''
}

export const secondsToDateStringWitoutTime = (seconds: number | undefined): string => {
    if (seconds) {
        return formatDisplayDate(+seconds)
    }
    return ''
}

export const secondsDateToString = (seconds: number | undefined): string => {
    if (seconds) {
        return new Date(+seconds).toDateString()
    }
    return ''
}

export const saveDocumentType = (setMainData: Function | undefined, mainData: Maindata) => {
  
  let { contentName } = mainData.document;
  let { currentDocument } = mainData.document;
  let newObj = {
      ...currentDocument,
      documentType: contentName as DocumentType,
  }

  if ( setMainData ) {
      setMainData('currentDocument', {...newObj})
  }
}


