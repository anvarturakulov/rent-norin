import axios from 'axios';
import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';

/**
 * Лёгкое обновление наименования элемента справочника (PATCH /api/references/:id).
 * Используется для быстрого редактирования name реквизитов ТМЗ (color/size/texture/...)
 * прямо из карточки ТМЗ. Не трогает состояние окон в mainData.
 * refValues передаём только если они есть у элемента — иначе бэкенд сохранит существующие
 * (важно для TMZ_SHORT_NAME, где в refValues лежит typeTMZ).
 */
export const updateReferenceName = async (
  element: ReferenceModel,
  newName: string,
  dictionaryType: TypeReference,
  token: string | undefined,
): Promise<ReferenceModel> => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNgrokBypassHeaders(),
    },
  };

  const body: Record<string, unknown> = {
    name: newName.trim(),
    typeReference: dictionaryType,
    isFolder: false,
    enterpriseId: element.enterpriseId ?? null,
  };
  if (element.refValues) {
    body.refValues = element.refValues;
  }

  const uri = withApiDomain('/api/references/' + element.id);
  const response = await axios.patch(uri, body, config);
  return response.data;
};
