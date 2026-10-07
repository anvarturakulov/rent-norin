import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { DocumentType, DocumentModel, normalizeDocTableItemsOrderForDualTables } from '@/app/interfaces/document.interface';
import { normalizeOptionalPaymentFieldsOnLoad } from './optionalPaymentFields';

// Функция, которая возвращает Promise с документом (без установки в state)
export const fetchDocumentById = async (
  id: number | undefined,
  token: string | undefined
): Promise<DocumentModel | null> => {
  if (!id || !token) return null;
  
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };
  
  try {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id;
    const response = await axios.get(uri, config);
    
    // Преобразуем date в docTableItems из bigint/string в number
    const docTableItems = response.data.docTableItems?.map((item: any) => {
      if (item.date !== undefined && item.date !== null) {
        // Преобразуем bigint (который приходит как строка в JSON) или строку в number
        if (typeof item.date === 'string') {
          const num = parseInt(item.date, 10);
          return { ...item, date: isNaN(num) || num <= 0 ? undefined : num };
        } else if (typeof item.date === 'bigint') {
          return { ...item, date: Number(item.date) };
        } else if (typeof item.date === 'number') {
          return item;
        }
      }
      return item;
    });
    
    const docType = response.data.documentType as DocumentType;
    const orderedItems = normalizeDocTableItemsOrderForDualTables(
      docTableItems || response.data.docTableItems,
      docType
    );
    const data = normalizeOptionalPaymentFieldsOnLoad({
      ...response.data,
      date: +response.data.date,
      documentType: docType,
      docTableItems: orderedItems
    });
    return data;
  } catch (error) {
    console.error('Ошибка при получении документа:', error);
    return null;
  }
};

export const getDocumentById = (
  id: number | undefined,
  setMainData: Function | undefined,
  token: string | undefined,
  showDocument : boolean = true,
  mainData?: any
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };
  if (id) {
    // previousContentName уже должен быть сохранен в getDocument перед вызовом этой функции

    if (setMainData) {
      setMainData('clearControlElements', true);
      setMainData('isNewDocument', false);
    }
    
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id;
    axios.get(uri, config)
      .then(function (response) {
        // Преобразуем date в docTableItems из bigint/string в number
        const docTableItems = response.data.docTableItems?.map((item: any) => {
          if (item.date !== undefined && item.date !== null) {
            // Преобразуем bigint (который приходит как строка в JSON) или строку в number
            if (typeof item.date === 'string') {
              const num = parseInt(item.date, 10);
              return { ...item, date: isNaN(num) || num <= 0 ? undefined : num };
            } else if (typeof item.date === 'bigint') {
              return { ...item, date: Number(item.date) };
            } else if (typeof item.date === 'number') {
              return item;
            }
          }
          return item;
        });
        
        const docType = response.data.documentType as DocumentType;
        const orderedItems = normalizeDocTableItemsOrderForDualTables(
          docTableItems || response.data.docTableItems,
          docType
        );
        const data = normalizeOptionalPaymentFieldsOnLoad({
          ...response.data,
          date: +response.data.date,
          documentType: docType,
          docTableItems: orderedItems
        });
        // Устанавливаем contentName на основе типа документа для корректного отображения
        setMainData && setMainData('contentName', data.documentType);
        setMainData && setMainData('currentDocument', data);
        setMainData && setMainData('journal.lastActedDocumentId', id);
        setMainData && setMainData('journal.navigateToLastActedDocument', true);
        setMainData && showDocument && setMainData('showDocumentWindow', true);
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  }
}