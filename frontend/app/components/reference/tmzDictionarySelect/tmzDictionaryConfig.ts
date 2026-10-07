import { TypeReference } from '@/app/interfaces/reference.interface';
import { TmzDictionaryAttrField } from './tmzDictionarySelect.props';

export const TMZ_ATTR_DICTIONARY_TYPE: Record<TmzDictionaryAttrField, TypeReference> = {
  shortName: TypeReference.TMZ_SHORT_NAME,
  size: TypeReference.TMZ_SIZE,
  color: TypeReference.TMZ_COLOR,
  texture: TypeReference.TMZ_TEXTURE,
  manufacture: TypeReference.TMZ_MANUFACTURE,
  unit: TypeReference.TMZ_UNIT,
};

export const TMZ_ATTR_ID_FIELD: Record<TmzDictionaryAttrField, string> = {
  shortName: 'shortNameId',
  size: 'sizeId',
  color: 'colorId',
  texture: 'textureId',
  manufacture: 'manufactureId',
  unit: 'unitId',
};
