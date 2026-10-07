'use client';

import { useMemo, useState } from 'react';
import { FurnitureOrdersProps } from './furnitureOrders.props';
import styles from './furnitureOrders.module.css';
import { useEnterpriseName } from '../../hooks/useEnterpriseName';
import { numberValue } from '@/app/service/common/converters';
import { formatDisplayDateOrDash } from '@/app/utils/formatDisplayDate';
import {
  ORDER_STAGE_SEQUENCE,
  OrderStageType,
  STAGE_LABELS,
  TEMPORARILY_DISABLED_STAGES,
} from '@/app/interfaces/furnitureOrder.interface';
import { MaterialWriteoffProgressModal } from './materialWriteoffProgressModal';
import { useAppContext } from '@/app/context/app.context';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import { resolveTmzProductImageUrl } from '@/app/utils/tmzProductImageUrl';
import { ImageModal } from '@/app/components/common/imageModal/ImageModal';

function ProductThumb({
  imagePath,
  alt,
}: {
  imagePath?: string | null;
  alt: string;
}) {
  const src = resolveTmzProductImageUrl(imagePath);
  const [failed, setFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!src || failed) {
    return <span className={styles.dash}>—</span>;
  }

  return (
    <>
      <button
        type="button"
        className={styles.thumbBtn}
        onClick={() => setModalOpen(true)}
        title="Расмни катталаштириш"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={styles.productThumb}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </button>
      <ImageModal
        isOpen={modalOpen}
        imageUrl={src}
        imageName={alt}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

type DocInfo = {
  documentId: number;
  date?: number;
  total: number;
};

type FileInfo = {
  url: string;
  originalName?: string;
};

type FurnitureOrderInformRow = {
  orderId: number;
  orderNumber: string;
  orderDate: number | null;
  deadlineDate: number | null;
  currentStage: string | null;
  productId: number | null;
  productName: string;
  productImagePath?: string | null;
  count: number;
  clientName: string;
  materialWriteoffDocs: DocInfo[];
  halfstuffWriteoffDocs: DocInfo[];
  receiptDocs: DocInfo[];
  saleDocs: DocInfo[];
  files: FileInfo[];
};

const STAGE_OPTIONS: OrderStageType[] = ORDER_STAGE_SEQUENCE.filter(
  (s) => !TEMPORARILY_DISABLED_STAGES.includes(s),
);

const fileHref = (url: string) => {
  if (!url) return '#';
  if (/^https?:\/\//i.test(url)) return url;
  const domain = process.env.NEXT_PUBLIC_DOMAIN || '';
  return `${domain}${url.startsWith('/') ? url : `/${url}`}`;
};

const stageLabel = (stage: string | null | undefined) => {
  if (!stage) return '—';
  return STAGE_LABELS[stage as OrderStageType] || stage;
};

export const FurnitureOrders = ({
  className,
  data,
  ...props
}: FurnitureOrdersProps): JSX.Element | null => {
  const { mainData, setMainData } = useAppContext();
  const token = mainData.users.user?.token;
  const contentName = mainData.document.contentName;
  const enterpriseName = useEnterpriseName();
  const [selectedStages, setSelectedStages] = useState<OrderStageType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOrderId, setModalOrderId] = useState<number | null>(null);
  const [modalOrderLabel, setModalOrderLabel] = useState('');
  const [modalProductName, setModalProductName] = useState('');

  const reportData: FurnitureOrderInformRow[] = useMemo(() => {
    if (!data) return [];
    const block = data.find((item: any) => item?.reportType === 'FurnitureOrders');
    return Array.isArray(block?.values) ? block.values : [];
  }, [data]);

  const allSelected = selectedStages.length === 0;

  const filteredRows = useMemo(() => {
    if (allSelected) return reportData;
    const set = new Set(selectedStages);
    return reportData.filter(
      (row) => row.currentStage != null && set.has(row.currentStage as OrderStageType),
    );
  }, [reportData, selectedStages, allSelected]);

  if (!reportData.length) {
    return null;
  }

  const toggleStage = (stage: OrderStageType) => {
    setSelectedStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  };

  const openMaterialsModal = (row: FurnitureOrderInformRow) => {
    setModalOrderId(row.orderId);
    setModalOrderLabel(
      `#${row.orderId}${row.orderNumber ? ` | №${row.orderNumber}` : ''}`,
    );
    setModalProductName(row.productName || '');
    setModalOpen(true);
  };

  const openDocument = (docId: number) => {
    if (!docId) return;
    getDocument(docId, setMainData, token, mainData, contentName);
  };

  const renderDocs = (docs: DocInfo[] | undefined, showTotal = true) => {
    if (!docs?.length) return <span className={styles.dash}>—</span>;
    return (
      <div className={styles.multiLine}>
        {docs.map((doc) => {
          const lines = [
            `№${doc.documentId}`,
            formatDisplayDateOrDash(doc.date),
          ];
          if (showTotal) {
            lines.push(numberValue(doc.total));
          }
          return (
            <button
              key={doc.documentId}
              type="button"
              data-report-doc-anchor={doc.documentId}
              className={styles.docLink}
              onClick={() => openDocument(doc.documentId)}
              title="Хужжатни очиш"
            >
              {lines.join('\n')}
            </button>
          );
        })}
      </div>
    );
  };

  const renderFiles = (files: FileInfo[] | undefined) => {
    if (!files?.length) return <span className={styles.dash}>—</span>;
    return (
      <div className={styles.multiLine}>
        {files.map((file, idx) => {
          const label = file.originalName || file.url.split('/').pop() || `Файл ${idx + 1}`;
          return (
            <a
              key={`${file.url}-${idx}`}
              className={styles.fileLink}
              href={fileHref(file.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {label}
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className={className} {...props}>
      <div className={styles.title}>
        Заявкалар (хужжатлар)
        {enterpriseName ? ` — ${enterpriseName}` : ''}
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${allSelected ? styles.filterBtnActive : ''}`}
          onClick={() => setSelectedStages([])}
        >
          Барчаси
        </button>
        {STAGE_OPTIONS.map((stage) => (
          <button
            key={stage}
            type="button"
            className={`${styles.filterBtn} ${
              selectedStages.includes(stage) ? styles.filterBtnActive : ''
            }`}
            onClick={() => toggleStage(stage)}
          >
            {STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className={styles.empty}>Танланган статус буйича заказлар йўқ</div>
      ) : (
        <div className={styles.tableContainer} data-report-scroll>
          <table className={styles.table}>
            <thead>
              <tr>
                <td>Номер</td>
                <td>Сана</td>
                <td>Мижоз</td>
                <td>Расм</td>
                <td>Тайёр махсулот</td>
                <td>Сон</td>
                <td>Хом ашё чикими</td>
                <td>ЯТМ чикими</td>
                <td>Тайёр мах. кирими</td>
                <td>Фактура</td>
                <td>Файллар</td>
                <td>Топшириш санаси</td>
                <td>Холати</td>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.orderId}>
                  <td className={styles.numCell}>
                    {row.orderNumber || row.orderId}
                  </td>
                  <td className={styles.dateCell}>
                    {formatDisplayDateOrDash(row.orderDate)}
                  </td>
                  <td className={styles.clientCell}>{row.clientName || '—'}</td>
                  <td className={styles.imageCell}>
                    <ProductThumb
                      imagePath={row.productImagePath}
                      alt={row.productName || ''}
                    />
                  </td>
                  <td className={styles.leftCell}>
                    <button
                      type="button"
                      className={styles.productLink}
                      onClick={() => openMaterialsModal(row)}
                      title="Хом ашё чикими — режа / факт"
                    >
                      {row.productName || '—'}
                    </button>
                  </td>
                  <td className={styles.numCell}>{numberValue(row.count)}</td>
                  <td>{renderDocs(row.materialWriteoffDocs)}</td>
                  <td>{renderDocs(row.halfstuffWriteoffDocs)}</td>
                  <td>{renderDocs(row.receiptDocs)}</td>
                  <td>{renderDocs(row.saleDocs, false)}</td>
                  <td>{renderFiles(row.files)}</td>
                  <td className={styles.dateCell}>
                    {formatDisplayDateOrDash(row.deadlineDate)}
                  </td>
                  <td className={styles.leftCell}>
                    {stageLabel(row.currentStage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MaterialWriteoffProgressModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalOrderId(null);
        }}
        orderId={modalOrderId}
        orderLabel={modalOrderLabel}
        productName={modalProductName}
      />
    </div>
  );
};
