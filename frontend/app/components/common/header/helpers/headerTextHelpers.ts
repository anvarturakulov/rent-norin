import { JournalMeta } from '@/app/service/documents/getJournalMeta';
import { formatDisplayDate, formatDisplayDateTime } from '@/app/utils/formatDisplayDate';

export const getTitleText = (contentType: string | undefined): string => {
    switch(contentType) {
        case 'document': return 'Хужжатлар'
        case 'reference': return 'Номлар'
        case 'servis': return 'Дастур'
        default: return 'Хисоботлар'
    }
}

export const getButtonText = (contentType: string | undefined): string => {
    switch(contentType) {
        case 'document': return 'Янги хужжат'
        case 'reference': return 'Янги ном'
        case 'servis': return 'Янги хусусият'
        default: return 'Янги элемент'
    }
}

export const getFirstText = (contentType: string | undefined, isNewDocument: boolean, isNewReference: boolean, isNewSetting?: boolean): string => {
    if (contentType === 'document') {
        return isNewDocument ? 'буйича янги хужжат тузиш' : 'буйича хужжатни куриш'
    } else if (contentType === 'servis') {
        return isNewSetting ? 'буйича янги хусусият тузиш' : 'буйича хусусиятни куриш'
    } else {
        return isNewReference ? 'буйича янги ном очиш' : 'буйича номни куриш'
    }
}

export const getSecondText = (contentType: string | undefined): string => {
    switch(contentType) {
        case 'document': return 'буйича хужжатлар руйхати'
        case 'reference': return 'буйича номлар руйхати'
        case 'servis': return 'буйича хусусиятлар руйхати'
        default: return 'буйича хисобот'
    }
}

const formatJournalDate = (value: number | string | null | undefined): string => {
    if (value == null) return '—';
    const num = typeof value === 'number' ? value : Number(new Date(value).getTime());
    return formatDisplayDate(num) || '—';
};

const formatJournalDateTime = (value: number | string | null | undefined): string => {
    if (value == null) return '—';
    const num = typeof value === 'number' ? value : Number(new Date(value).getTime());
    return formatDisplayDateTime(num) || '—';
};

export const JOURNAL_META_PLACEHOLDER = 'Охирги хужжат санаси';

export const getJournalMetaText = (journalMeta?: JournalMeta | null): string => {
    if (!journalMeta) return '';
    if (journalMeta.lastDocumentDate == null && journalMeta.lastModifiedAt == null) {
        return 'Хужжатлар йўқ';
    }
    return [
        `Охирги хужжат санаси: ${formatJournalDate(journalMeta.lastDocumentDate)}`,
        `Охирги ўзгариш: ${formatJournalDateTime(journalMeta.lastModifiedAt)}`,
    ].join(' · ');
};

export const getDateRangeText = (dateStart: number | undefined, dateEnd: number | undefined): string => {
    if (!dateStart || !dateEnd) return ''
    
    const formatDate = (date: number) => formatDisplayDate(date)
    
    const dateStartInStr = formatDate(dateStart)
    const dateEndInStr = formatDate(dateEnd)
    return `оралик сана: ${dateStartInStr} дан ${dateEndInStr} гача`
} 