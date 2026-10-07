import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Maindata } from '@/app/context/app.context.interfaces';
import { fetchDocumentById } from './getDocumentById';

export const markToDeleteDocument = (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined,
  mainData?: Maindata,
  reopen?: boolean,
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const reopenQuery = reopen ? '?reopen=true' : '';
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/markToDelete/' + id + reopenQuery;
    axios.delete(uri, config)
      .then(async function () {
        if (setMainData) {
          showMessage(`Хужжат холати узгартирилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
          
          // Если документ открыт в редакторе, обновляем currentDocument
          const { currentDocument } = mainData?.document || {};
          if (currentDocument?.id === id && token) {
            const updatedDocument = await fetchDocumentById(id, token);
            if (updatedDocument) {
              setMainData('currentDocument', updatedDocument);
            }
          }
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}