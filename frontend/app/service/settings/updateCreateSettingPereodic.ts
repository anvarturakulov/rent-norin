import { SettingPereodicModel } from '@/app/interfaces/settings.interface';
import axios from 'axios';
import { showMessage } from '../common/showMessage';

export const updateCreateSettingPereodic = (
  body: SettingPereodicModel,
  isNew: boolean,
  setMainData: Function | undefined,
  token: string | undefined,
  enterpriseId?: number | null
) => {
  const config: any = {
    headers: { Authorization: `Bearer ${token}` }
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    config.headers['x-enterprise-id'] = enterpriseId.toString();
  }

  const actionWithMainData = (mes: string) => {
    if (setMainData) {
      showMessage(mes, 'success', setMainData);
      setMainData('showSettingPereodicWindow', false);
      setMainData('isNewSettingPereodic', false);
      setMainData('updateDataForSettingPereodicsList', true);
    }
  };

  const payload = {
    date: body.date,
    settingId: body.settingId,
    value: body.value,
    enterpriseId: body.enterpriseId,
  };

  const domain = process.env.NEXT_PUBLIC_DOMAIN;
  const uriPost = `${domain}/api/settings/${body.settingId}/pereodic`;
  const uriPut = `${domain}/api/settings/${body.settingId}/pereodic/${body.id}`;

  if (isNew) {
    axios.post(uriPost, payload, config)
      .then(() => actionWithMainData('Янги қиймат қўшилди'))
      .catch((error) => {
        if (setMainData) {
          showMessage(error.message, 'error', setMainData);
        }
      });
  } else {
    if (body.id) {
      axios.put(uriPut, payload, config)
        .then(() => actionWithMainData('Қиймат янгиланди'))
        .catch((error) => {
          if (setMainData) {
            showMessage(error.message, 'error', setMainData);
          }
        });
    }
  }
};
