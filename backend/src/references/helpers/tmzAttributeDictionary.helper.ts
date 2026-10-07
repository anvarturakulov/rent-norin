import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";

export const TMZ_ATTR_ID_TO_TEXT: Record<string, keyof import("src/interfaces/reference.interface").RefValues> = {
  shortNameId: "shortName",
  sizeId: "size",
  colorId: "color",
  textureId: "texture",
  manufactureId: "manufacture",
  unitId: "unit",
};

export function trimAttr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Effective short name for OS when refValues.shortName is empty. */
export function effectiveTmzShortNameText(
  shortName: unknown,
  tmzName: unknown,
  typeTMZ?: TypeTMZ,
): string {
  const sn = trimAttr(shortName);
  if (sn) return sn;
  if (typeTMZ === TypeTMZ.OS) {
    return trimAttr(tmzName);
  }
  return "";
}

/** Ключ уникальности TMZ_SHORT_NAME в БД (совпадает с миграцией). */
export function buildTmzShortNameDictKey(
  name: string,
  typeTMZ: TypeTMZ,
  enterpriseId?: number | null,
): string {
  const trimmed = trimAttr(name);
  return [
    TypeReference.TMZ_SHORT_NAME,
    typeTMZ,
    enterpriseId == null ? "null" : String(enterpriseId),
    trimmed.toLowerCase(),
  ].join("\x1f");
}

export function dictionaryTypeForAttrField(
  field: "shortName" | "size" | "color" | "texture" | "manufacture" | "unit",
): TypeReference {
  switch (field) {
    case "shortName":
      return TypeReference.TMZ_SHORT_NAME;
    case "size":
      return TypeReference.TMZ_SIZE;
    case "color":
      return TypeReference.TMZ_COLOR;
    case "texture":
      return TypeReference.TMZ_TEXTURE;
    case "manufacture":
      return TypeReference.TMZ_MANUFACTURE;
    case "unit":
      return TypeReference.TMZ_UNIT;
    default:
      return TypeReference.TMZ_SHORT_NAME;
  }
}
