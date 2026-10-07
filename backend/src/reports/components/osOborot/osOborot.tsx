import { TypeReference, TypeSECTION } from "src/interfaces/reference.interface";
import { Reference } from "src/references/reference.model";
import { StocksService } from "src/stocks/stocks.service";
import { OborotsService } from "src/oborots/oborots.service";
import { osOborotSkladItem } from "./osOborotItem";

const normalizeSectionId = (
  section: number | string | null | undefined,
): number | null => {
  if (section == null || section === -1 || section === "-1") return null;
  const n = Number(section);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const osOborot = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  section: number | null,
  stocksService: StocksService,
  oborotsService: OborotsService,
  enterpriseId?: number | null,
) => {
  const sectionFilter = normalizeSectionId(section);

  const filteredStorages = data.filter(
    (item) =>
      item?.typeReference === TypeReference.STORAGES &&
      !item.refValues?.markToDeleted &&
      (item.refValues?.typeSection === TypeSECTION.STORAGE ||
        item.refValues?.typeSection === TypeSECTION.COMMON ||
        item.refValues?.typeSection === TypeSECTION.PRODUCTION) &&
      (sectionFilter !== null ? item.id == sectionFilter : true) &&
      (enterpriseId != null
        ? item.enterpriseId === enterpriseId || item.enterpriseId === null
        : true),
  );

  const sections: Awaited<ReturnType<typeof osOborotSkladItem>>[] = [];
  for (const storage of filteredStorages) {
    const block = await osOborotSkladItem(
      data,
      startDate,
      endDate,
      storage.id,
      storage.name,
      stocksService,
      oborotsService,
      enterpriseId,
    );
    if (block.items?.length) {
      sections.push(block);
    }
  }

  return { values: sections };
};
