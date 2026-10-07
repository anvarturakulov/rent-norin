'use client'
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from './workerStageJournal.module.css';
import { useAppContext } from '@/app/context/app.context';
import { foApi } from '@/app/service/furnitureOrders/furnitureOrders.service';
import {
  FurnitureOrder,
  OrderStageFileMeta,
  STAGE_LABELS,
  UpdateFurnitureOrderPayload,
} from '@/app/interfaces/furnitureOrder.interface';
import { getWorkerRoleConfig } from '../helpers/workerRoleStageConfig';
import OrderStoreWorkTab from '../furnitureOrderCard/orderStoreWorkTab';

type FileField = 'filesFromScaling' | 'filesFromStore' | 'filesFromDelivery';

const FILE_FIELD_BY_STAGE: Record<string, FileField | undefined> = {
  SCALING: 'filesFromScaling',
  STORE: 'filesFromStore',
  DELIVERY: 'filesFromDelivery',
};

const parseFileList = (raw?: string): OrderStageFileMeta[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): OrderStageFileMeta | null => {
        if (typeof item === 'string') return { url: item, visibleToClient: false };
        if (!item || typeof item !== 'object') return null;
        const value = item as Record<string, unknown>;
        const url = typeof value.url === 'string' ? value.url.trim() : '';
        if (!url) return null;
        return {
          url,
          originalName: typeof value.originalName === 'string' ? value.originalName : undefined,
          visibleToClient: value.visibleToClient === true || value.visibleToClient === 'true',
        };
      })
      .filter((item): item is OrderStageFileMeta => Boolean(item));
  } catch {
    return [];
  }
};

const formatDate = (value?: number | string) => {
  if (!value) return '—';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
};

export default function WorkerStageJournal() {
  const { mainData } = useAppContext();
  const { user } = mainData.users;
  const token = user?.token || '';
  const roleConfig = getWorkerRoleConfig(user?.role);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const ordersKey = token && user?.enterpriseId && roleConfig
    ? ['worker-stage-orders', token, user.enterpriseId, roleConfig.stage]
    : null;

  const { data: orders = [], mutate, error } = useSWR<FurnitureOrder[]>(
    ordersKey,
    () => foApi.getOrders(token, user!.enterpriseId!, roleConfig!.stage),
  );

  const fileField = roleConfig ? FILE_FIELD_BY_STAGE[roleConfig.stage] : undefined;

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(b.id) - Number(a.id)),
    [orders],
  );

  const handleUploadFiles = async (order: FurnitureOrder, files: FileList | null) => {
    if (!files || !fileField || !token) return;
    setBusyOrderId(order.id);
    try {
      const currentList = parseFileList(order[fileField]);
      const uploadedList: OrderStageFileMeta[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await foApi.uploadFurnitureOrderFile(token, file);
        uploadedList.push({ url: uploaded.url, originalName: file.name, visibleToClient: false });
      }
      const payload: UpdateFurnitureOrderPayload = {
        [fileField]: JSON.stringify([...currentList, ...uploadedList]),
      };
      await foApi.updateOrder(token, order.id, payload);
      await mutate();
    } catch (e: any) {
      alert(e.message || 'Ошибка загрузки файлов');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCompleteOrder = async (order: FurnitureOrder) => {
    if (!token || !user?.id) return;
    setBusyOrderId(order.id);
    try {
      await foApi.advanceStage(token, order.id, user.id);
      await mutate();
    } catch (e: any) {
      alert(e.message || 'Ошибка завершения этапа');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleRevertOrder = async (order: FurnitureOrder) => {
    if (!token || !user?.id) return;
    setBusyOrderId(order.id);
    try {
      await foApi.revertStage(token, order.id, user.id);
      await mutate();
    } catch (e: any) {
      alert(e.message || 'Ошибка возврата на предыдущий этап');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (!roleConfig) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Роль не поддерживается для stage-журнала.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{roleConfig.title}</h2>
        <p>Этап: {STAGE_LABELS[roleConfig.stage]}</p>
      </div>

      {error && <div className={styles.error}>Хатолик: {error.message}</div>}
      {!error && !ordersKey && <div className={styles.empty}>Нет данных для загрузки</div>}
      {!error && ordersKey && sortedOrders.length === 0 && <div className={styles.empty}>Ҳозирча заказлар йўқ</div>}

      <div className={styles.grid}>
        {sortedOrders.map((order) => {
          const files = fileField ? parseFileList(order[fileField]) : [];
          const busy = busyOrderId === order.id;
          return (
            <div key={order.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.orderNumber}>Заказ #{order.orderNumber || order.id}</div>
                <span className={styles.stageBadge}>{STAGE_LABELS[roleConfig.stage]}</span>
              </div>
              <div className={styles.productName}>{(order.analitic?.name || 'НАИМЕНОВАНИЕ НЕ УКАЗАНО').toUpperCase()}</div>
              <div className={styles.metaList}>
                <div className={styles.meta}>Сана: {formatDate(order.orderDate ?? order.createdDate)}</div>
                <div className={styles.meta}>Мижоз: {(order.client?.name || 'КЛИЕНТ НЕ УКАЗАН').toUpperCase()}</div>
              </div>

              {roleConfig.stage === 'STORE' && (
                <div className={styles.storeWorkBlock}>
                  <OrderStoreWorkTab
                    order={order}
                    token={token}
                    userId={user?.id}
                    onOrderUpdated={() => mutate()}
                  />
                </div>
              )}

              <div className={styles.filesBlock}>
                <div className={styles.filesTitle}>Файлы этапа</div>
                {files.length === 0 && <div className={styles.filesEmpty}>Файлов пока нет</div>}
                {files.map((file) => (
                  <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className={styles.fileItem}>
                    {file.originalName || file.url.split('/').pop() || 'Файл'}
                  </a>
                ))}
              </div>

              <div className={styles.cardActions}>
                <label className={styles.uploadBtn}>
                  + Файл юклаш
                  <input
                    type="file"
                    multiple
                    hidden
                    disabled={busy}
                    onChange={(e) => handleUploadFiles(order, e.target.files)}
                  />
                </label>

                <button
                  className={styles.completeBtn}
                  disabled={busy}
                  onClick={() => handleCompleteOrder(order)}
                >
                  {busy ? 'Сақланмоқда...' : 'Этапни якунлаш'}
                </button>
                {roleConfig.stage !== 'TALABGOR' && (
                  <button
                    className={styles.revertBtn}
                    disabled={busy}
                    onClick={() => handleRevertOrder(order)}
                  >
                    ← Олдинги босқичга
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
