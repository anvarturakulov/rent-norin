'use client';

import { numberValue } from '@/app/service/common/converters';
import { ComeMaterialTmzByArticleProps } from './comeMaterialTmzByArticle.props';
import styles from './comeMaterialTmzByArticle.module.css';

export const ComeMaterialTmzByArticle = ({
  data,
  ...props
}: ComeMaterialTmzByArticleProps): JSX.Element => {
  const formatPeriodDate = (value: number | null | undefined): string => {
    if (!value) return '-';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU');
  };

  const report = Array.isArray(data)
    ? data.find((item: any) => item?.reportType === 'COMEMATERIALTMZBYARTICLE')
    : null;
  const values = report?.values;
  const materials = values?.materials ?? [];
  const totals = values?.totals;

  if (!values) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>Материал приходи (артикул)</div>
        <div className={styles.emptyMessage}>Маълумотлар юкланмоқда</div>
      </div>
    );
  }

  const periodLabel = `${formatPeriodDate(values.periodStart)} — ${formatPeriodDate(values.periodEnd)}`;

  if (!materials.length) {
    return (
      <div className={styles.container} {...props}>
        <div className={styles.title}>Материал приходи (артикул)</div>
        <div className={styles.subtitle}>Давр: {periodLabel}</div>
        <div className={styles.emptyMessage}>
          ComeMaterial ҳужжатлари бўйича материал топилмади
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} {...props}>
      <div className={styles.title}>Материал приходи (артикул)</div>
      <div className={styles.subtitle}>
        Давр: {periodLabel} · Ҳужжатлар: {totals?.documentsCount ?? 0} ·
        Материаллар: {totals?.uniqueMaterials ?? 0} · Артикуллар:{' '}
        {totals?.uniqueArticles ?? 0}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.center} ${styles.indexCol}`}>№</th>
            <th className={styles.articleCol}>Артикул</th>
            <th>Материал</th>
            <th className={styles.unitCol}>Улч. бир.</th>
            <th className={styles.numeric}>Сони</th>
            <th className={styles.numeric}>Сумма</th>
            <th className={styles.numeric}>Қаторлар</th>
            <th className={styles.numeric}>Ҳужжатлар</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material: any, index: number) => (
            <tr key={material.materialId}>
              <td className={`${styles.center} ${styles.indexCol}`}>
                {index + 1}
              </td>
              <td>{material.article || '-'}</td>
              <td>{material.materialName}</td>
              <td className={styles.unitCol}>{material.unit || '-'}</td>
              <td className={styles.numeric}>
                {numberValue(Number(material.totalCount) || 0)}
              </td>
              <td className={styles.numeric}>
                {numberValue(Number(material.totalSum) || 0)}
              </td>
              <td className={styles.numeric}>{material.linesCount ?? 0}</td>
              <td className={styles.numeric}>{material.documentsCount ?? 0}</td>
            </tr>
          ))}
          <tr className={styles.summaryRow}>
            <td colSpan={4} className={styles.center}>
              Жами
            </td>
            <td className={styles.numeric}>
              {numberValue(Number(totals?.totalCount) || 0)}
            </td>
            <td className={styles.numeric}>
              {numberValue(Number(totals?.totalSum) || 0)}
            </td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  );
};
