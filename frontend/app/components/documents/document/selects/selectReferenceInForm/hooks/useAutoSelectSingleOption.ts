import { useEffect } from 'react';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { DocSTATUS } from '@/app/interfaces/document.interface';

interface UseAutoSelectSingleOptionParams {
  type: string;
  data: ReferenceModel[];
  currentItemId: number | undefined | null;
  definedItemId: number | undefined | null;
  disabled: boolean;
  isLoading: boolean;
  docStatus: DocSTATUS | undefined;
  handleItemSelect: (item: ReferenceModel) => void;
}

export const useAutoSelectSingleOption = ({
  type,
  data,
  currentItemId,
  definedItemId,
  disabled,
  isLoading,
  docStatus,
  handleItemSelect,
}: UseAutoSelectSingleOptionParams): void => {
  useEffect(() => {
    if (type !== 'sender' && type !== 'receiver') return;
    if (isLoading || disabled) return;
    if (definedItemId) return;
    if (currentItemId && currentItemId > 0) return;
    if (docStatus && docStatus !== DocSTATUS.OPEN) return;

    const selectableItems = data.filter((item) => !item.isFolder);
    if (selectableItems.length !== 1) return;

    handleItemSelect(selectableItems[0]);
  }, [
    type,
    data,
    currentItemId,
    definedItemId,
    disabled,
    isLoading,
    docStatus,
    handleItemSelect,
  ]);
};
