import { showMessage } from '../common/showMessage';
import axios from 'axios';
import { Maindata } from '@/app/context/app.context.interfaces';
import { DEBETKREDIT, EntryItem, Schet } from '@/app/interfaces/report.interface';

export type AnaliticDateRange = {
  startDate?: number | null;
  endDate?: number | null;
};

function buildAnaliticUrl(
  mainData: Maindata,
  firstSubcontoId: string | number,
  secondSubcontoId: string | number | null | undefined,
  dk: DEBETKREDIT,
  schetOverride?: Schet,
  dateRange?: AnaliticDateRange,
): { url: string; token: string | undefined } {
  const { user } = mainData.users;
  const { reportOption, selectedEnterpriseId } = mainData.report;
  const { interval } = mainData.journal;
  const startDate = dateRange?.startDate ?? interval.dateStart ?? reportOption.startDate;
  const endDate = dateRange?.endDate ?? interval.dateEnd ?? reportOption.endDate;
  const finalSchet = schetOverride || reportOption.schet;

  let url =
    process.env.NEXT_PUBLIC_DOMAIN +
    '/api/reports/analitic' +
    '?startDate=' +
    startDate +
    '&endDate=' +
    endDate +
    '&schet=' +
    finalSchet +
    '&firstSubcontoId=' +
    firstSubcontoId +
    '&dk=' +
    dk;

  if (secondSubcontoId !== null && secondSubcontoId !== undefined && secondSubcontoId !== '') {
    url += '&secondSubcontoId=' + secondSubcontoId;
  }

  if (selectedEnterpriseId !== null && selectedEnterpriseId !== undefined) {
    const enterpriseId =
      typeof selectedEnterpriseId === 'object' && selectedEnterpriseId !== null
        ? (selectedEnterpriseId as { id?: number })?.id
        : selectedEnterpriseId;
    if (enterpriseId !== null && enterpriseId !== undefined && typeof enterpriseId === 'number') {
      url += '&enterpriseId=' + enterpriseId;
    }
  }

  return { url, token: user?.token };
}

function normalizeAnaliticEntry(raw: unknown): EntryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = (raw as { dataValues?: Record<string, unknown> }).dataValues ?? raw;
  const e = row as Record<string, unknown>;
  const date = Number(e.date);
  if (!Number.isFinite(date)) return null;

  return {
    date,
    docNumber: Number(e.docNumber ?? e.docId) || 0,
    docId: String(e.docId ?? ''),
    documentType: e.documentType as EntryItem['documentType'],
    debet: e.debet as EntryItem['debet'],
    debetFirstSubcontoId: String(e.debetFirstSubcontoId ?? ''),
    debetSecondSubcontoId: String(e.debetSecondSubcontoId ?? ''),
    kredit: e.kredit as EntryItem['kredit'],
    kreditFirstSubcontoId: String(e.kreditFirstSubcontoId ?? ''),
    kreditSecondSubcontoId: String(e.kreditSecondSubcontoId ?? ''),
    count: Number(e.count) || 0,
    total: Number(e.total ?? e.summa) || 0,
    description: String(e.description ?? ''),
    fullDescription: e.fullDescription ? String(e.fullDescription) : undefined,
  };
}

export async function fetchAnaliticEntries(
  mainData: Maindata,
  firstSubcontoId: string | number,
  secondSubcontoId: string | number | null | undefined,
  dk: DEBETKREDIT,
  schetOverride?: Schet,
  dateRange?: AnaliticDateRange,
): Promise<EntryItem[]> {
  const { url, token } = buildAnaliticUrl(
    mainData,
    firstSubcontoId,
    secondSubcontoId,
    dk,
    schetOverride,
    dateRange,
  );
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };
  const response = await axios.get<unknown>(url, config);
  const payload = response.data;
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  return list
    .map((item) => normalizeAnaliticEntry(item))
    .filter((item): item is EntryItem => item !== null);
}

export const getAnalitic = (
  setMainData: Function | undefined,
  mainData: Maindata,
  firstSubcontoId: string,
  secondSubcontoId: string,
  dk: DEBETKREDIT,
  schetOverride?: Schet,
) => {
  const { url, token } = buildAnaliticUrl(mainData, firstSubcontoId, secondSubcontoId, dk, schetOverride);

  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

  showMessage('Маълумот юкланмокда. Кутуб туринг', 'warm', setMainData);
  axios
    .get(url, config)
    .then(function (response) {
      if (setMainData) {
        showMessage([...response.data], 'warm', setMainData);
      }
    })
    .catch(function (error) {
      if (setMainData) {
        showMessage(error.message, 'error', setMainData);
      }
    });

  setMainData && setMainData('loading', false);
};