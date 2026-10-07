import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Reference } from "src/references/reference.model";
import { RefValues } from "src/refvalues/refValues.model";
import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";
import { PereodicService } from "src/pereodic/pereodic.service";

export type PublicCatalogItemDto = {
  id: number;
  name: string;
  article: string | null;
  parentId: number | null;
  isFolder: boolean;
  unit?: string | null;
  websiteDescription?: string | null;
  displayPrice?: number | null;
  hourlyPrice?: number | null;
  dailyPrice?: number | null;
  /** Имена файлов в uploads/images/products (как в refvalues.imagePath) */
  images: string[];
};

@Injectable()
export class PublicCatalogService {
  constructor(
    @InjectModel(Reference) private readonly referenceModel: typeof Reference,
    private readonly pereodicService: PereodicService,
  ) {}

  async getTree(): Promise<{ items: PublicCatalogItemDto[] }> {
    return this.getTreeByType(
      TypeTMZ.PRODUCT,
      process.env.PUBLIC_CATALOG_ENTERPRISE_ID,
    );
  }

  async getToolsTree(): Promise<{ items: PublicCatalogItemDto[] }> {
    return this.getTreeByType(
      TypeTMZ.TOOLS,
      process.env.PUBLIC_TOOLS_CATALOG_ENTERPRISE_ID,
    );
  }

  private resolveEnterpriseFilter(raw: string | undefined): {
    filter: Record<string, unknown> | null;
    pereodicEnterpriseOrder: (number | null)[];
  } | null {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed === "null") {
      return {
        filter: { enterpriseId: null },
        pereodicEnterpriseOrder: [null],
      };
    }

    const id = parseInt(trimmed, 10);
    if (!Number.isFinite(id)) {
      return null;
    }

    return {
      filter: {
        [Op.or]: [{ enterpriseId: null }, { enterpriseId: id }],
      },
      pereodicEnterpriseOrder: [id, null],
    };
  }

  private async getTreeByType(
    typeTMZ: TypeTMZ.PRODUCT | TypeTMZ.TOOLS,
    enterpriseEnvRaw: string | undefined,
  ): Promise<{ items: PublicCatalogItemDto[] }> {
    const resolved = this.resolveEnterpriseFilter(enterpriseEnvRaw);
    if (!resolved) {
      return { items: [] };
    }

    const { filter: enterpriseFilter, pereodicEnterpriseOrder } = resolved;

    const all = await this.referenceModel.findAll({
      where: {
        typeReference: TypeReference.TMZ,
        ...enterpriseFilter,
      },
      include: [{ model: RefValues, required: false }],
    });

    const byId = new Map<number, Reference>();
    for (const r of all) {
      byId.set(r.id, r);
    }

    const published: Reference[] = [];
    for (const r of all) {
      if (r.isFolder) continue;
      const rv = r.refValues;
      if (!rv || rv.markToDeleted) continue;
      if (rv.typeTMZ !== typeTMZ) continue;
      if (!rv.showOnWebsite) continue;
      published.push(r);
    }

    const hiddenFolderNames = this.getHiddenCatalogFolderNames();

    /**
     * Не показываем в чипах каталога:
     * — папки с parentId «корень» (первый уровень TMZ);
     * — папки с именем из списка (часто «Готовая продукция» / «Материалы» под общим корнём-зонтиком).
     */
    const shouldSkipFolderInCatalog = (folder: Reference): boolean => {
      if (!folder.isFolder) return true;
      const pid = folder.parentId;
      if (pid == null || pid === undefined || Number(pid) === 0) {
        return true;
      }
      const key = PublicCatalogService.normalizeFolderName(folder.name);
      if (key && hiddenFolderNames.has(key)) {
        return true;
      }
      return false;
    };

    const folderIds = new Set<number>();
    for (const r of published) {
      let pid: number | null | undefined = r.parentId;
      while (pid != null) {
        const parent = byId.get(pid);
        if (!parent) break;
        if (parent.isFolder && !shouldSkipFolderInCatalog(parent)) {
          folderIds.add(pid);
        }
        pid = parent.parentId ?? null;
      }
    }

    const collectImages = (rv: RefValues): string[] => {
      return [rv.imagePath, rv.imagePath2, rv.imagePath3].filter(
        (x): x is string => Boolean(x && String(x).trim()),
      );
    };

    const items: PublicCatalogItemDto[] = [];

    for (const r of all) {
      if (r.isFolder && folderIds.has(r.id) && !shouldSkipFolderInCatalog(r)) {
        items.push({
          id: r.id,
          name: r.name,
          article: r.article ?? null,
          parentId: r.parentId ?? null,
          isFolder: true,
          unit: null,
          websiteDescription: null,
          displayPrice: null,
          hourlyPrice: null,
          dailyPrice: null,
          images: [],
        });
      }
    }

    const priceRows = await Promise.all(
      published.map((r) =>
        typeTMZ === TypeTMZ.TOOLS
          ? this.resolveRentalPrices(r.id, r.refValues!, pereodicEnterpriseOrder)
          : this.resolveDisplayPrice(r.id, r.refValues!, pereodicEnterpriseOrder).then(
              (displayPrice) => ({ displayPrice, hourlyPrice: null, dailyPrice: null }),
            ),
      ),
    );

    published.forEach((r, idx) => {
      const rv = r.refValues!;
      const prices = priceRows[idx];
      items.push({
        id: r.id,
        name: r.name,
        article: r.article ?? null,
        parentId: r.parentId ?? null,
        isFolder: false,
        unit: rv.unit ?? null,
        websiteDescription: rv.websiteDescription ?? null,
        displayPrice: prices.displayPrice,
        hourlyPrice: prices.hourlyPrice,
        dailyPrice: prices.dailyPrice,
        images: collectImages(rv),
      });
    });

    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "ru");
    });

    return { items };
  }

  /**
   * Цена для витрины: thirdPrice по истории (на сегодня), иначе из refvalues, иначе 2/1 цена.
   */
  private async resolveDisplayPrice(
    referenceId: number,
    rv: RefValues,
    enterpriseTryOrder: (number | null)[],
  ): Promise<number | null> {
    const today = Date.now();
    for (const ent of enterpriseTryOrder) {
      const v = await this.pereodicService.getPeredicValueForDate(
        referenceId,
        "thirdPrice",
        today,
        ent,
      );
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }

    if (
      rv.thirdPrice != null &&
      !Number.isNaN(Number(rv.thirdPrice)) &&
      Number(rv.thirdPrice) > 0
    ) {
      return Number(rv.thirdPrice);
    }
    if (
      rv.secondPrice != null &&
      !Number.isNaN(Number(rv.secondPrice)) &&
      Number(rv.secondPrice) > 0
    ) {
      return Number(rv.secondPrice);
    }
    if (
      rv.firstPrice != null &&
      !Number.isNaN(Number(rv.firstPrice)) &&
      Number(rv.firstPrice) > 0
    ) {
      return Number(rv.firstPrice);
    }
    return null;
  }

  /** Соатлик тариф (firstPrice) и суточная аренда (× 24) для инструментов. */
  private async resolveRentalPrices(
    referenceId: number,
    rv: RefValues,
    enterpriseTryOrder: (number | null)[],
  ): Promise<{
    displayPrice: null;
    hourlyPrice: number | null;
    dailyPrice: number | null;
  }> {
    const today = Date.now();
    let hourly: number | null = null;

    for (const ent of enterpriseTryOrder) {
      const v = await this.pereodicService.getPeredicValueForDate(
        referenceId,
        "firstPrice",
        today,
        ent,
      );
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) {
        hourly = n;
        break;
      }
    }

    if (hourly == null) {
      if (
        rv.firstPrice != null &&
        !Number.isNaN(Number(rv.firstPrice)) &&
        Number(rv.firstPrice) > 0
      ) {
        hourly = Number(rv.firstPrice);
      }
    }

    const daily =
      hourly != null ? Math.round(hourly * 24 * 100) / 100 : null;

    return {
      displayPrice: null,
      hourlyPrice: hourly,
      dailyPrice: daily,
    };
  }

  private static normalizeFolderName(name?: string | null): string {
    return (name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** Имена папок, которые не выводить в каталоге (через запятую в env + встроенные синонимы) */
  private getHiddenCatalogFolderNames(): Set<string> {
    const defaults = [
      "готовая продукция",
      "гатовая продукция",
      "материалы",
      "материал",
      "materials",
      "material",
    ];
    const fromEnv = (process.env.PUBLIC_CATALOG_HIDE_FOLDER_NAMES || "")
      .split(",")
      .map((s) => PublicCatalogService.normalizeFolderName(s))
      .filter(Boolean);
    return new Set([...defaults, ...fromEnv]);
  }
}
