import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { Maindata } from '@/app/context/app.context.interfaces';
import { checkInterEnterprise } from './checkInterEnterprise';
import { DocumentType } from '@/app/interfaces/document.interface';
import {
  isReceiveToolsPaymentFilled,
  isReceiveToolsPaymentGatePassed,
} from './optionalPaymentFields';
import { fetchClientS40Balance } from './fetchClientS40Balance';
import { getBalanceTargetDate } from '@/app/components/documents/document/docValues/components/clientBalanceInfo/clientBalanceCalculations';
import { maybeAlertReadyRentalOrders } from './maybeAlertReadyRentalOrders';

const inFlightProvodkaIds = new Set<number>();

export const  setProvodkaToDocument = async (
  id: number | undefined,
  setMainData: Function | undefined,
  mainData: Maindata
) => {
  
  const { user } = mainData.users;
  const token = user?.token;

  if (!id) {
    return;
  }

  if (inFlightProvodkaIds.has(id)) {
    return;
  }
  inFlightProvodkaIds.add(id);

  try {
  let postedDocumentType: string | undefined;
  // Получаем документ для проверки межпредприятийности
  try {
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    
    const documentUri = `${process.env.NEXT_PUBLIC_DOMAIN}/api/documents/${id}`;
    const documentResponse = await axios.get(documentUri, config);
    const document = documentResponse.data;
    postedDocumentType = document?.documentType;

    if (document) {
      if (document.documentType === DocumentType.ReceiveToolsFromClient) {
        const clientId = Number(document.docValues?.senderId || 0);
        let paymentGatePassed = false;

        if (clientId > 0 && token) {
          try {
            const beforeS40 = await fetchClientS40Balance({
              clientId,
              endDate: getBalanceTargetDate(document.date),
              token,
              enterpriseId: document.enterpriseId ?? user?.enterpriseId,
            });
            paymentGatePassed = isReceiveToolsPaymentGatePassed(
              document.docValues,
              document.docTableItems,
              beforeS40,
            );
          } catch {
            paymentGatePassed = isReceiveToolsPaymentFilled(document.docValues);
          }
        } else {
          paymentGatePassed = isReceiveToolsPaymentFilled(document.docValues);
        }

        if (!paymentGatePassed) {
          if (setMainData) {
            showMessage('Тулов тулдирилмаган', 'error', setMainData);
          }
          return;
        }
      }

      // Проверяем, должен ли документ быть межпредприятийным
      const interEnterpriseCheck = await checkInterEnterprise(
        document.docValues?.receiverId,
        document.documentType,
        user?.enterpriseId,
        token,
        mainData.settings?.singleEnterpriseMode
      );

      // Если документ должен быть межпредприятийным, но еще не помечен как таковой
      if (interEnterpriseCheck.isInterEnterprise && !document.isInterEnterprise) {
        if (setMainData) {
          showMessage('Бу хужжат оралика документ. Аввал хужжатни жўнатиш керак.', 'error', setMainData);
        }
        return;
      }

      // Если документ уже межпредприятийный, не позволяем проводить напрямую
      if (document.isInterEnterprise) {
        if (setMainData) {
          showMessage('Оралика хужжатни тўғридан-тўғри ўтказиб бўлмайди. Аввал хужжатни жўнатиш керак.', 'error', setMainData);
        }
        return;
      }
    }
  } catch (error) {
    // Если не удалось получить документ, продолжаем с обычной логикой
    console.error('Error checking document before provodka:', error);
  }

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  let temp = {}
  
  const uri = process.env.NEXT_PUBLIC_DOMAIN + '/api/documents/setProvodka/' + id;
  try {
    await axios.patch(uri, temp, config);
    if (setMainData) {
      showMessage(`Хужжат холати узгартирилди`, 'success', setMainData);
      setMainData('updateDataForDocumentJournal', true);
    }
    await maybeAlertReadyRentalOrders(mainData, setMainData, postedDocumentType);
  } catch (error: any) {
    if (setMainData) {
      const errorMessage = error.response?.data?.message || error.message || 'Ошибка при изменении статуса документа';
      showMessage(errorMessage, 'error', setMainData)
    }
  }
  } finally {
    inFlightProvodkaIds.delete(id);
  }
}