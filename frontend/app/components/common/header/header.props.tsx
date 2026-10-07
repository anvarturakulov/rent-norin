import { DetailedHTMLProps, HTMLAttributes } from "react";
import { JournalMeta } from "@/app/service/documents/getJournalMeta";

export interface HeaderProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  windowFor: 'document' | 'reference' | 'report' | 'gate' | 'settings',
  count?: number,
  total?: number,
  onPrint?: () => void,
  onBack?: () => void,
  onRefresh?: () => void,
  onFilterClick?: () => void,
  activeFilterCount?: number,
  hasJournalMeta?: boolean,
  journalMeta?: JournalMeta | null,
  isJournalMetaLoading?: boolean,
  onJournalMetaClick?: () => void,
}