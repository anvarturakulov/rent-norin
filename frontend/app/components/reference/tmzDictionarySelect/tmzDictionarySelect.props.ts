import { TypeReference, TypeTMZ } from '@/app/interfaces/reference.interface';

export type TmzDictionaryAttrField =
  | 'shortName'
  | 'size'
  | 'color'
  | 'texture'
  | 'manufacture'
  | 'unit';

export interface TmzDictionarySelectProps {
  attrField: TmzDictionaryAttrField;
  dictionaryType: TypeReference;
  label: string;
  valueId?: number | null;
  valueText?: string | null;
  enterpriseId?: number | null;
  typeTMZ?: TypeTMZ;
  disabled?: boolean;
  className?: string;
  showInlineCreateButton?: boolean;
  onChange: (id: number | null, text: string) => void;
}
