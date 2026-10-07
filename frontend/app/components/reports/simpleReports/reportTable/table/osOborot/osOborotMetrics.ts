export type OsOborotMetrics = {
  POS01: number;
  POS02: number;
  residualStart: number;
  TDS01: number;
  TKS02: number;
  TKS01: number;
  TDS02: number;
  KOS01: number;
  KOS02: number;
  residualEnd: number;
};

export const OS_METRIC_KEYS: (keyof OsOborotMetrics)[] = [
  'POS01',
  'POS02',
  'residualStart',
  'TDS01',
  'TKS02',
  'TKS01',
  'TDS02',
  'KOS01',
  'KOS02',
  'residualEnd',
];

export function metricsFromRow(el: any): OsOborotMetrics {
  const pos01 = Number(el?.POS01) || 0;
  const pos02 = Number(el?.POS02) || 0;
  const kos01 = Number(el?.KOS01) || 0;
  const kos02 = Number(el?.KOS02) || 0;
  return {
    POS01: pos01,
    POS02: pos02,
    residualStart:
      el?.residualStart != null
        ? Number(el.residualStart) || 0
        : pos01 - pos02,
    TDS01: Number(el?.TDS01) || 0,
    TKS02: Number(el?.TKS02) || 0,
    TKS01: Number(el?.TKS01) || 0,
    TDS02: Number(el?.TDS02) || 0,
    KOS01: kos01,
    KOS02: kos02,
    residualEnd:
      el?.residualEnd != null
        ? Number(el.residualEnd) || 0
        : kos01 - kos02,
  };
}

export function aggregateOsMetrics(rows: any[]): OsOborotMetrics {
  const result: OsOborotMetrics = {
    POS01: 0,
    POS02: 0,
    residualStart: 0,
    TDS01: 0,
    TKS02: 0,
    TKS01: 0,
    TDS02: 0,
    KOS01: 0,
    KOS02: 0,
    residualEnd: 0,
  };
  for (const el of rows) {
    const m = metricsFromRow(el);
    for (const key of OS_METRIC_KEYS) {
      result[key] += m[key];
    }
  }
  return result;
}
