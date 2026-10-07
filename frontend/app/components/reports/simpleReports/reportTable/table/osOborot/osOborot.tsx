'use client';

import { useAppContext } from '@/app/context/app.context';
import { OsOborotItem } from './OsOborotItem';
import { OsOborotTableHeader } from './OsOborotTableHeader';
import styles from './osOborot.module.css';

export const OsOborot = (): JSX.Element => {
  const { mainData } = useAppContext();
  const { osOborot } = mainData.report;

  const sections = osOborot?.[0]?.values ?? [];

  if (!sections.length) {
    return <div className={styles.emptyState}>Асосий воситалар бўйича маълумот йўқ</div>;
  }

  return (
    <>
      {sections.map((sec: any, sKey: number) => (
        <div key={sec.sectionId ?? sKey} className={styles.sectionContainer}>
          <h3 className={styles.sectionTitle}>{sec.section}</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <OsOborotTableHeader />
              <OsOborotItem items={sec.items ?? []} sectionId={sec.sectionId} />
            </table>
          </div>
        </div>
      ))}
    </>
  );
};
