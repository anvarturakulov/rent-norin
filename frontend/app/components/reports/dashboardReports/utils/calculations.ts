// Утилитарные функции для расчетов
export const totalByKey = (key: string, data: any[]): number => {
  if (!data?.length) return 0;
  return data.reduce((total, item) => total + (item[key] || 0), 0);
};

export const totalByKeyForFinancial = (key: string, data: any[]): number => {
  if (!data?.length) return 0;
  return data.reduce((total, item) => total + (item[key] || 0), 0);
};

// Дополнительные утилитарные функции
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const formatCurrency = (amount: number, currency: string = 'UZS'): string => {
  return new Intl.NumberFormat('uz-UZ', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('uz-UZ').format(num);
}; 