// Типы для компонента Inform
export interface PDFConfig {
  SCALE: number;
  QUALITY: number;
  MAX_SIZE_MB: number;
  PAGE_SIZE: string;
  ORIENTATION: string;
}

export interface ReportData {
  [key: string]: any;
}

export interface DateInterval {
  dateStart: number;
  dateEnd: number;
}

export interface User {
  role?: string;
  [key: string]: any;
}

export interface MainData {
  window: {
    uploadingDashboard: boolean;
  };
  users: {
    user: User;
  };
  report: {
    informData: ReportData;
    dashboardCurrentReportType: string;
  };
  journal: {
    interval: DateInterval;
  };
} 