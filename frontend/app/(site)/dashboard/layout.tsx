'use client'
import styles from './layout.module.css';
import { Sidebar } from '@/app/components/sidebar/sidebar';
import Taskbar from '@/app/components/taskbar/taskbar';
import { useAppContext } from '@/app/context/app.context';
import { useState, useCallback } from 'react';
import cn from 'classnames';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { mainData } = useAppContext();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  
  // Стабильная ссылка: иначе useEffect в Sidebar с [onStateChange] вызывает setState родителя на каждом рендере → maximum update depth.
  const handleSidebarStateChange = useCallback((isCollapsed: boolean, isExpanded: boolean) => {
    setIsSidebarCollapsed(isCollapsed);
    setIsSidebarExpanded(isExpanded);
  }, []);
  
  const sidebarAutoCollapseKey = '';

  const hasTaskbar = mainData.minimizedWindows.length > 0;

  return (
    <div className={`${styles.layout} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${isSidebarExpanded ? styles.sidebarExpanded : ''}`}>
      <Sidebar
        onStateChange={handleSidebarStateChange}
        autoCollapseKey={sidebarAutoCollapseKey}
      />
      <div className={styles.dashboard_main}>
        <div
          data-dashboard-scroll
          className={cn(styles.dashboard_content, {
            [styles.dashboard_contentWithTaskbar]: hasTaskbar,
          })}
        >
          {children}
        </div>
        <Taskbar />
      </div>
    </div>
  )
}
