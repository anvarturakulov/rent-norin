import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DocumentType } from '@/app/interfaces/document.interface';

/**
 * Проверяет, должен ли документ быть межпредприятийным
 * @param receiverId - ID получателя (reference)
 * @param documentType - Тип документа
 * @param userEnterpriseId - ID предприятия пользователя
 * @param token - Токен авторизации
 * @returns Promise с информацией о том, является ли документ межпредприятийным
 */
export const checkInterEnterprise = async (
  receiverId: number | undefined | null,
  documentType: DocumentType,
  userEnterpriseId: number | null | undefined,
  token: string | undefined,
  singleEnterpriseMode?: boolean
): Promise<{
  isInterEnterprise: boolean;
  targetEnterpriseId: number | null;
}> => {
  if (singleEnterpriseMode) {
    return { isInterEnterprise: false, targetEnterpriseId: null };
  }

  if (!receiverId || !token) {
    return {
      isInterEnterprise: false,
      targetEnterpriseId: null,
    };
  }

  try {
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    
    const uri = `${process.env.NEXT_PUBLIC_DOMAIN}/api/references/${receiverId}`;
    const response = await axios.get(uri, config);
    const receiverReference = response.data;

    if (!receiverReference) {
      return {
        isInterEnterprise: false,
        targetEnterpriseId: null,
      };
    }

    const targetEnterpriseId = receiverReference?.enterpriseId ?? null;

    if (!targetEnterpriseId) {
      return {
        isInterEnterprise: false,
        targetEnterpriseId: null,
      };
    }

    // Проверяем, что targetEnterpriseId отличается от user.enterpriseId
    // Документ может быть межпредприятийным только если targetEnterpriseId !== userEnterpriseId
    if (userEnterpriseId !== null && userEnterpriseId !== undefined && targetEnterpriseId === userEnterpriseId) {
      return {
        isInterEnterprise: false,
        targetEnterpriseId: null,
      };
    }

    return {
      isInterEnterprise: true,
      targetEnterpriseId,
    };
  } catch (error) {
    // В случае ошибки считаем, что документ не межпредприятийный
    console.error('Error checking inter-enterprise status:', error);
    return {
      isInterEnterprise: false,
      targetEnterpriseId: null,
    };
  }
};










