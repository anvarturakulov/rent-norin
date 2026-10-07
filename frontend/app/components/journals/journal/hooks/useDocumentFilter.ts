import { useMemo } from 'react';
import { DocumentModel } from '@/app/interfaces/document.interface';
import { filterDocuments } from '../journal.helpers';

type TabType = 'CASH' | 'BANK' | 'USD' | 'PLASTIK';

export const useDocumentFilter = (
    documents: DocumentModel[] | undefined,
    journalChechboxs: any,
    references: any,
    mainData: any,
    role: string,
    contentName: string,
    activeTab: TabType = 'CASH'
) => {
    return useMemo(() => {
        if (documents && !Array.isArray(documents)) {
            console.error('documents is not an array:', documents);
            return [];
        }

        if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
            const possibleArray = Object.values(documents).find((value) => Array.isArray(value));
            if (possibleArray) {
                console.warn('Found array in documents object, using it:', possibleArray);
                return filterDocuments(
                    possibleArray as DocumentModel[],
                    journalChechboxs,
                    references,
                    mainData,
                    role,
                    contentName,
                    activeTab,
                );
            }
            return [];
        }

        return documents
            ? filterDocuments(
                  documents,
                  journalChechboxs,
                  references,
                  mainData,
                  role,
                  contentName,
                  activeTab,
              )
            : [];
    }, [documents, journalChechboxs, references, mainData, role, contentName, activeTab]);
};
