import { ReferenceModel, TypeReference } from '@/app/interfaces/reference.interface';
import axios from 'axios';
import { getNgrokBypassHeaders, withApiDomain } from '@/app/service/common/getApiDomain';
import { showMessage } from '../common/showMessage';
import { getApiErrorMessage } from '../common/getApiErrorMessage';
import { KeyedMutator, mutate as globalMutate } from 'swr';
import { setInlineQuickAddBlocked } from '@/app/components/reference/inlineReferenceQuickAddGuard';
import { normalizeTmzDrawingFilesList } from '@/app/utils/tmzDrawingScalingFiles';

export const updateCreateReference = (
  body: ReferenceModel,
  typeReference: TypeReference,
  isNewReference: boolean,
  setMainData: Function | undefined,
  token: string | undefined,
  mutate?: KeyedMutator<ReferenceModel[]>,
  inlineInstanceId?: string,
  inlineSlotKey: string = 'reference.inlineCreation'
) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNgrokBypassHeaders(),
    },
  };
  
  const actionWithMainData = (mes: string, createdReference?: ReferenceModel) => {
    if (setMainData) {
      showMessage(`${body.name} - ${typeReference} - ${mes}`, 'success', setMainData)
      if (inlineInstanceId && createdReference) {
        setInlineQuickAddBlocked(900);
        const payload = {
          reference: createdReference,
          instanceId: inlineInstanceId,
        };
        // Сначала блокируем клики по странице: иначе «Саклаш» доходит до кнопки «+» под модалкой и открывает PARTNERS.
        let prevPointerEvents = '';
        let pointerKillSwitch: number | undefined;
        if (typeof document !== 'undefined') {
          prevPointerEvents = document.body.style.pointerEvents;
          document.body.style.pointerEvents = 'none';
          pointerKillSwitch = window.setTimeout(() => {
            document.body.style.pointerEvents = prevPointerEvents;
          }, 2500);
        }
        const schedule =
          typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function'
            ? (fn: () => void) => {
                globalThis.requestAnimationFrame(() => {
                  globalThis.requestAnimationFrame(fn);
                });
              }
            : (fn: () => void) => {
                setTimeout(fn, 48);
              };
        schedule(() => {
          // Окно выбора товара — только после создания; при редактировании (двойной клик) остаёмся в каталоге.
          if (isNewReference) {
            setMainData('reference.lastCreatedForInline', payload);
          }
          setMainData(inlineSlotKey, null);
          // Ревалидацию SWR делаем после закрытия модалки — иначе перерисовка документа сдвигает слои и ловит «ложный» клик.
          globalMutate(
            (key) => typeof key === 'string' && key.includes('/api/references/'),
            undefined,
            { revalidate: true },
          );
          if (typeof document !== 'undefined') {
            if (pointerKillSwitch) {
              window.clearTimeout(pointerKillSwitch);
            }
            window.setTimeout(() => {
              document.body.style.pointerEvents = prevPointerEvents;
            }, 400);
          }
        });
      } else {
        setMainData('clearControlElements', true);
        setMainData('showReferenceWindow', false);
        setMainData('isNewReference', false);
      }
    }
    
    // Оптимистичное обновление: используем данные с сервера без дополнительного запроса
    if (mutate && createdReference) {
      mutate((currentData: ReferenceModel[] = []) => {
        if (isNewReference) {
          // Для нового элемента: добавляем в начало списка
          // Фильтруем по типу справочника, чтобы не добавить элемент другого типа
          const filteredData = currentData.filter(item => item.typeReference === typeReference);
          return [createdReference, ...filteredData];
        } else {
          // Для обновления: заменяем существующий элемент
          return currentData.map(item => 
            item.id === createdReference.id ? createdReference : item
          );
        }
      }, { revalidate: false }); // Не делаем дополнительный запрос
    } else if (mutate) {
      // Если данных нет, делаем обычную ревалидацию
      mutate(undefined, { revalidate: true });
    }
  }

  const id = body.id;
  const bodyCopy = { ...body };
  delete bodyCopy.id;
  delete (bodyCopy as { tmzDictKey?: unknown }).tmzDictKey;

  if (bodyCopy.refValues) {
    const rv = { ...bodyCopy.refValues };
    // null в JSONB через PATCH превращает колонку в NULL в БД — не отправляем
    if (rv.filesFromScaling === null) delete rv.filesFromScaling;
    if (rv.filesFromDrawing === null) delete rv.filesFromDrawing;
    if (rv.filesFromScaling != null) {
      rv.filesFromScaling = normalizeTmzDrawingFilesList(rv.filesFromScaling);
    }
    if (rv.filesFromDrawing != null) {
      rv.filesFromDrawing = normalizeTmzDrawingFilesList(rv.filesFromDrawing);
    }
    bodyCopy.refValues = rv;
  }

  const uriPost = withApiDomain('/api/references/create');
  const uriPatch = withApiDomain('/api/references/' + id);

  if (isNewReference) {
    axios.post(uriPost, bodyCopy, config)
      .then(function (response) {
        // Используем данные, которые вернул сервер
        actionWithMainData('янги элемент киритилди', response.data)
      })
      .catch(function (error) {
        if (setMainData) {
          const errorMessage = getApiErrorMessage(error, 'Ошибка при создании справочника');
          showMessage(errorMessage, 'error', setMainData)
        }
        // При ошибке делаем ревалидацию для синхронизации
        if (mutate) {
          mutate(undefined, { revalidate: true });
        }
      });
  } else {
    if (id) {
      axios.patch(uriPatch, bodyCopy, config)
        .then(function (response) {
          // Используем данные, которые вернул сервер
          actionWithMainData('элемент янгиланди', response.data)
        })
        .catch(function (error) {
          if (setMainData) {
            const errorMessage = getApiErrorMessage(error, 'Ошибка при обновлении справочника');
            showMessage(errorMessage, 'error', setMainData)
          }
          // При ошибке делаем ревалидацию для синхронизации
          if (mutate) {
            mutate(undefined, { revalidate: true });
          }
        });
    };
  }
}