import { ReferenceModel } from '@/app/interfaces/reference.interface';
import axios from 'axios';
import { showMessage } from '../common/showMessage';
import { UserModel } from '@/app/interfaces/user.interface';

export const updateCreateUser = (
  body: UserModel,
  isNewReference: boolean,
  setMainData: Function | undefined,
  token: string | undefined
) => {
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };
  const actionWithMainData = (mes: string) => {
    if (setMainData) {
      showMessage(`${body.name} - ${mes}`, 'success', setMainData)
      setMainData('showUserWindow', false);
      setMainData('clearControlElements', true);
      setMainData('isNewUser', false);
    }
  }

  const id = body.id;
  // Удаляем служебные поля Sequelize и id перед отправкой
  const { id: _, createdAt, updatedAt, ...userData } = body as any;
  
  // Удаляем sectionId если он не задан (0, undefined, null) для обновления
  if (!isNewReference && (userData.sectionId === undefined || userData.sectionId === null || userData.sectionId === 0)) {
    delete userData.sectionId;
  }

  const uriPost = process.env.NEXT_PUBLIC_DOMAIN + '/api/auth/registration';
  const uriPatch = process.env.NEXT_PUBLIC_DOMAIN + '/api/users/' + id;

  if (isNewReference) {
    axios.post(uriPost, userData, config)
      .then(function () {
        actionWithMainData('янги элемент киритилди')
      })
      .catch(function (error) {
        if (setMainData) {
          const errorMessage = error.response?.data?.message || error.message || 'Ошибка при создании пользователя';
          showMessage(errorMessage, 'error', setMainData)
        }
      });
  } else {
    if (id) {
      axios.patch(uriPatch, userData, config)
        .then(function () {
          actionWithMainData('элемент янгиланди')
        })
        .catch(function (error) {
          if (setMainData) {
            const errorMessage = error.response?.data?.message || error.message || 'Ошибка при обновлении пользователя';
            showMessage(errorMessage, 'error', setMainData)
          }
        });
    };
  }
}