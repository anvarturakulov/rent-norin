'use client';

import { useMemo } from 'react';
import { useAppContext } from '@/app/context/app.context';
import { MinimizedWindow, MinimizedWindowType } from '@/app/context/app.context.interfaces';
import {
  closeMinimizedWindow,
  restoreWindow,
} from '@/app/service/common/minimizeWindow';
import styles from './taskbar.module.css';

const TYPE_LABELS: Record<MinimizedWindowType, string> = {
  document: 'Хужжат',
  reference: 'Ном',
  settings: 'Хусусият',
  user: 'Фойдаланувчи',
  enterprise: 'Корхона',
};

export default function Taskbar() {
  const { mainData, setMainData } = useAppContext();
  const windows = mainData.minimizedWindows;

  const sorted = useMemo(
    () => [...windows].sort((a, b) => a.minimizedAt - b.minimizedAt),
    [windows],
  );

  if (sorted.length === 0) return null;

  const handleRestore = (win: MinimizedWindow) => {
    if (!setMainData) return;
    restoreWindow(win, mainData, setMainData);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!setMainData) return;
    closeMinimizedWindow(id, mainData, setMainData);
  };

  return (
    <div className={styles.taskbar} role="toolbar" aria-label="Свернутые окна">
      {sorted.map((win) => (
        <button
          key={win.id}
          type="button"
          className={styles.chip}
          onClick={() => handleRestore(win)}
          title={win.title}
        >
          <span className={styles.chipType}>{TYPE_LABELS[win.type]}</span>
          <span className={styles.chipTitle}>{win.title}</span>
          <span
            role="button"
            tabIndex={0}
            className={styles.chipClose}
            onClick={(e) => handleClose(e, win.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose(e as unknown as React.MouseEvent, win.id);
              }
            }}
            aria-label="Закрыть"
            title="Закрыть"
          >
            &#10005;
          </span>
        </button>
      ))}
    </div>
  );
}
