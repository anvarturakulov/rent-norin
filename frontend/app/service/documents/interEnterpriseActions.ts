import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Maindata } from '@/app/context/app.context.interfaces';
import { fetchDocumentById } from './getDocumentById';

export const sendInterEnterpriseDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/send';
    axios.post(uri, { enterpriseId: user?.enterpriseId }, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат жўнатилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const cancelSendingInterEnterpriseDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/cancel-sending';
    axios.post(uri, { enterpriseId: user?.enterpriseId }, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Жўнатиш бекор килинди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const acceptInterEnterpriseDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata,
  enterpriseIdOverride?: number | null
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/accept';
    // Используем enterpriseIdOverride, если передан, иначе используем enterpriseId пользователя
    const enterpriseId = enterpriseIdOverride !== undefined && enterpriseIdOverride !== null 
      ? enterpriseIdOverride 
      : user?.enterpriseId;
    axios.post(uri, { enterpriseId }, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат кабул килинди ва проводка берилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const approveInternalDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/approve-internal';
    axios.post(uri, {}, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат тасдикланди ва проводка берилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const sendInternalDocumentToPending = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/send-to-pending';
    axios.post(uri, {}, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат тасдиқлаш учун жўнатилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const rejectInterEnterpriseDocument = async (
  id: number | undefined,
  reason: string,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/reject';
    axios.post(uri, { enterpriseId: user?.enterpriseId, reason }, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат рад этилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const returnInterEnterpriseDocumentToWork = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/return-to-work';
    axios.post(uri, { enterpriseId: user?.enterpriseId }, config)
      .then(function () {
        if (setMainData) {
          showMessage(`Хужжат ишга кайтарилди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);
        }
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

export const cancelInterEnterpriseProvodka = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  const { user } = mainData.users;
  const token = user?.token;

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (id) {
    const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/' + id + '/cancel-provodka';
    console.log('[FRONTEND] cancelInterEnterpriseProvodka - Отправка запроса:', { id, uri, enterpriseId: user?.enterpriseId });
    axios.post(uri, { enterpriseId: user?.enterpriseId }, config)
      .then(async function (response) {
        console.log('[FRONTEND] cancelInterEnterpriseProvodka - Успешный ответ:', response.data);
        if (setMainData) {
          showMessage(`Проводка бекор килинди`, 'success', setMainData);
          setMainData('updateDataForDocumentJournal', true);

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
        console.error('[FRONTEND] cancelInterEnterpriseProvodka - Ошибка:', error.response?.data || error.message);
        if (setMainData) {
          showMessage(error.response?.data?.message || error.message, 'error', setMainData)
        }
      });
  }
};

