'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAppContext } from '@/app/context/app.context';
import { EntryItem, Schet } from '@/app/interfaces/report.interface';
import { getDocument } from '@/app/components/journals/journal/helpers/journal.functions';
import { MatOborotEntriesModal } from '@/app/components/reports/simpleReports/reportTable/table/matOborot/matOborotItem/MatOborotEntriesModal';

export type OrderEntriesModalRequest = {
  type: 'income' | 'expense';
  orderId: number | null;
  saleDocId?: number | null;
  debet?: Schet;
  kredit?: Schet;
  orderLabel: string;
  columnLabel: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  request: OrderEntriesModalRequest | null;
  startDate: number;
  endDate: number;
};

function mapEntryToItem(entry: any): EntryItem {
  return {
    date: Number(entry.date),
    docNumber: entry.docId ? Number(entry.docId) : 0,
    docId: entry.docId ? String(entry.docId) : '',
    documentType: entry.documentType,
    debet: entry.debet,
    debetFirstSubcontoId: entry.debetFirstSubcontoId ? String(entry.debetFirstSubcontoId) : '',
    debetFirstSubcontoName: entry.debetFirstSubcontoReference?.name || '',
    debetSecondSubcontoId: entry.debetSecondSubcontoId ? String(entry.debetSecondSubcontoId) : '',
    debetSecondSubcontoName: entry.debetSecondSubcontoReference?.name || '',
    kredit: entry.kredit,
    kreditFirstSubcontoId: entry.kreditFirstSubcontoId ? String(entry.kreditFirstSubcontoId) : '',
    kreditFirstSubcontoName: entry.kreditFirstSubcontoReference?.name || '',
    kreditSecondSubcontoId: entry.kreditSecondSubcontoId ? String(entry.kreditSecondSubcontoId) : '',
    kreditSecondSubcontoName: entry.kreditSecondSubcontoReference?.name || '',
    count: entry.count || 0,
    total: entry.total || 0,
    description: entry.description || '',
    fullDescription: entry.fullDescription || '',
  };
}

export function OrderEntriesDetailsModal({
  isOpen,
  onClose,
  request,
  startDate,
  endDate,
}: Props) {
  const { mainData, setMainData } = useAppContext();
  const { user } = mainData.users;
  const { selectedEnterpriseId } = mainData.report;
  const references = mainData.reference?.allReferences;

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<EntryItem[]>([]);

  const title = request ? `${request.orderLabel} — ${request.columnLabel}` : '';

  const loadEntries = useCallback(async () => {
    if (!request || !isOpen) return;

    setLoading(true);
    setEntries([]);

    try {
      const enterpriseId =
        typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
          ? (selectedEnterpriseId as { id?: number }).id
          : selectedEnterpriseId;

      let url =
        `${process.env.NEXT_PUBLIC_DOMAIN}/api/reports/foyda-by-order/entries?` +
        `type=${request.type}&` +
        `startDate=${startDate}&` +
        `endDate=${endDate}`;

      if (request.type === 'income') {
        if (request.orderId != null) {
          url += `&orderId=${request.orderId}`;
          if (request.saleDocId) {
            url += `&saleDocId=${request.saleDocId}`;
          }
        }
      }

      if (request.type === 'expense') {
        url += `&debet=${request.debet}&kredit=${request.kredit}`;
        if (request.orderId != null) {
          url += `&orderId=${request.orderId}`;
        }
      }

      if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
        url += `&enterpriseId=${enterpriseId}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      const formatted = (response.data || []).map(mapEntryToItem);
      setEntries(formatted);
    } catch (error) {
      console.error('Ошибка при загрузке проводок по заказу:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [request, isOpen, startDate, endDate, selectedEnterpriseId, user?.token]);

  useEffect(() => {
    if (isOpen && request) {
      void loadEntries();
    } else {
      setEntries([]);
      setLoading(false);
    }
  }, [isOpen, request, loadEntries]);

  const handleSelectDocument = useCallback(
    (docId: number) => {
      onClose();
      void getDocument(
        docId,
        setMainData,
        user?.token,
        mainData,
        mainData.document.contentName,
      );
    },
    [onClose, setMainData, user?.token, mainData],
  );

  return (
    <MatOborotEntriesModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      loading={loading}
      entries={entries}
      references={references}
      onSelectDocument={handleSelectDocument}
    />
  );
}
