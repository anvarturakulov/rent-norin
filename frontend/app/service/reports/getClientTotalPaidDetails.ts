import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { EntryItem } from '@/app/interfaces/report.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { Schet } from '@/app/interfaces/report.interface';

export const getClientTotalPaidDetails = async (
  setMainData: Function | undefined,
  mainData: Maindata,
  clientId: number,
  startDate: number,
  endDate: number,
) => {
  const { user } = mainData.users;
  const { selectedEnterpriseId } = mainData.report;

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };
  
  let url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/client-total-paid-details?clientId=${clientId}&startDate=${startDate}&endDate=${endDate}`;
  
  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId = typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null 
      ? (selectedEnterpriseId as any)?.id 
      : selectedEnterpriseId;
    if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
      url += `&enterpriseId=${enterpriseId}`;
    }
  }

  showMessage('Маълумот юкланмокда. Кутуб туринг', 'warm', setMainData);
  
  try {
    const response = await axios.get(url, config);
    const details = response.data;
    
    // Форматируем детализацию для отображения
    if (details && details.length > 0) {
      const entryItems: EntryItem[] = details.map((item: any) => ({
        date: Number(item.date) || Number(item.documentDate) || 0,
        docNumber: Number(item.documentNumber) || 0,
        docId: String(item.docId) || '',
        documentType: (item.documentType as DocumentType) || DocumentType.ComeCashFromClients,
        debet: Schet.S50,
        debetFirstSubcontoId: '',
        debetSecondSubcontoId: '',
        kredit: Schet.S40,
        kreditFirstSubcontoId: '',
        kreditSecondSubcontoId: '',
        count: 0,
        total: Number(item.total) || 0,
        description: item.comment || ''
      }));
      
      showMessage(entryItems, 'warm', setMainData);
    } else {
      showMessage('Оплаты за указанный период не найдены', 'warm', setMainData);
    }
  } catch (error: any) {
    if (setMainData) {
      showMessage(error.message || 'Ошибка при загрузке детализации', 'error', setMainData);
    }
  }

  setMainData && setMainData('loading', false);
};

