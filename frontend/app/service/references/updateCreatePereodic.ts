import { PereodicModel } from '@/app/interfaces/reference.interface';
import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const updateCreatePereodic = (
  body: PereodicModel,
  isNewPereodic: boolean,
  setMainData: Function | undefined,
  token: string | undefined,
  enterpriseId?: number | null
) => {
  const config: any = {
    headers: { Authorization: `Bearer ${token}` }
  };
  
  // Добавляем enterpriseId в заголовок если есть
  if (enterpriseId !== undefined && enterpriseId !== null) {
    config.headers['x-enterprise-id'] = enterpriseId.toString();
  }
  const actionWithMainData = (mes: string) => {
    if (setMainData) {
      showMessage(`${body.name} - ${mes}`, 'success', setMainData)
      setMainData('showPereodicWindow', false);
      setMainData('clearControlElements', true);
      setMainData('isNewPereodic', false);
      setMainData('updateDataForPereodicsList', true);
    }
  }

  const id = body.id;
  const payload: Pick<PereodicModel, 'date' | 'referenceId' | 'name' | 'value'> & {
    enterpriseId?: number | null;
  } = {
    date: body.date,
    referenceId: body.referenceId,
    name: body.name,
    value: body.value
  };
  if (body.enterpriseId !== undefined) {
    payload.enterpriseId = body.enterpriseId;
  }

  const uriPost = process.env.NEXT_PUBLIC_DOMAIN + '/api/pereodic/create';
  const uriPatch = process.env.NEXT_PUBLIC_DOMAIN + '/api/pereodic/update/' + id;

  if (isNewPereodic) {
    axios.post(uriPost, payload, config)
      .then(function () {
        actionWithMainData('янги элемент киритилди')
      })
      .catch(function (error) {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData)
        }
      });
  } else {
    if (id) {
      axios.patch(uriPatch, payload, config)
        .then(function () {
          actionWithMainData('элемент янгиланди')
        })
        .catch(function (error) {
          if (setMainData) {
            showMessage(error.message, 'error', setMainData)
          }
        });
    };
  }
}