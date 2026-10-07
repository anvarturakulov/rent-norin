import { docsDependentToMiddlePrice } from '@/app/components/documents/document/doc/helpers/documentTypes';
import { Maindata } from '@/app/context/app.context.interfaces';
import { Schet } from '@/app/interfaces/report.interface';
import axios from 'axios';

export const setPriceAndBalance = (
  mainData: Maindata,
  setMainData: Function | undefined,
  schet: Schet,
  firstSubcontoId: number | undefined,
  secondSubcontoId: number | undefined,
  endDate: number | null,
  forTable: boolean,
  indexTableItem: number
) => {

  let { user } = mainData.users;
  let { currentDocument } = mainData.document;
  let { docTableItems } = currentDocument;
  let { contentName } = mainData.document;

  let currentItem = { ...currentDocument }

  if (!firstSubcontoId) firstSubcontoId=-1;

  let url = process.env.NEXT_PUBLIC_DOMAIN + '/api/reports/priceAndBalance' +
    '?&schet=' + schet +'&endDate=' + endDate +
    '&firstSubcontoId=' + firstSubcontoId + 
    '&secondSubcontoId=' + secondSubcontoId;

  const config = {
    headers: { Authorization: `Bearer ${user?.token}` }
  };

  axios.get(url, config)
    .then(function (request) {
      let result = {...request.data};
      if (!forTable) {
        if (currentItem.docValues) {
          // balance больше не используется в docValues, он есть только в docTableItems
          if (docsDependentToMiddlePrice.includes(contentName)) {
            currentItem.docValues.price = result?.price
          }
        }
      } else {
        if (docTableItems && docTableItems?.length > 0) {
          const currentItem = docTableItems[indexTableItem];
          
          // Обновляем остаток и цену
          currentItem.balance = +result?.balance;
          currentItem.price = +result?.price;
          if (currentItem.tableType === 'expense') {
            currentItem.costPrice = +result?.price;
            const count = currentItem.count ?? 0;
            currentItem.costTotal = Math.round((currentItem.costPrice * count) * 100) / 100;
            currentItem.total = currentItem.costTotal;
          }
          
          console.log(`📊 setPriceAndBalance: обновлены остатки для ${currentItem.tableType || 'income'} товара ID ${currentItem.analiticId}:`, {
            balance: currentItem.balance,
            price: currentItem.price,
            count: currentItem.count,
            tableType: currentItem.tableType
          });
        }
      }

      if (setMainData) {
        setMainData('currentDocument', {...currentItem})
      }
    })
    .catch(function (error) {
      
    });
}