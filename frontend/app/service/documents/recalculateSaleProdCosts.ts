import axios from 'axios';
import { DocumentModel } from '@/app/interfaces/document.interface';

export const recalculateSaleProdCosts = async (
  documentId: number,
  token: string
): Promise<DocumentModel> => {
  let API_URL: string;
  if (typeof window !== 'undefined') {
    API_URL = process.env.NEXT_PUBLIC_DOMAIN || window.location.origin;
  } else {
    API_URL = process.env.NEXT_PUBLIC_DOMAIN || 'http://localhost:5009';
  }

  const response = await axios.post(
    `${API_URL}/api/documents/${documentId}/recalculate-costs`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

