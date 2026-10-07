import { Op } from "sequelize";
import { Document } from "src/documents/document.model";
import { DocTableItems } from "src/docTableItems/docTableItems.model";
import { DocumentType, DocSTATUS } from "src/interfaces/document.interface";
import { Reference } from "src/references/reference.model";
import { TypeReference, TypeTMZ } from "src/interfaces/reference.interface";

interface ComeMaterialTmzRow {
  materialId: number;
  materialName: string;
  article: string;
  unit: string;
  totalCount: number;
  totalSum: number;
  documentsCount: number;
  linesCount: number;
}

interface ComeMaterialTmzTotals {
  documentsCount: number;
  uniqueMaterials: number;
  uniqueArticles: number;
  totalCount: number;
  totalSum: number;
}

interface ComeMaterialTmzValues {
  periodStart: number | null;
  periodEnd: number | null;
  materials: ComeMaterialTmzRow[];
  totals: ComeMaterialTmzTotals;
}

const emptyTotals = (): ComeMaterialTmzTotals => ({
  documentsCount: 0,
  uniqueMaterials: 0,
  uniqueArticles: 0,
  totalCount: 0,
  totalSum: 0,
});

const buildDocumentWhere = (
  startDate: number,
  endDate: number,
  enterpriseId?: number | null,
) => {
  const dateFilter = {
    date: { [Op.gte]: startDate, [Op.lte]: endDate },
  };
  const typeFilter = {
    [Op.or]: [
      { enterpriseId, documentType: DocumentType.ComeMaterial },
      {
        isInterEnterprise: true,
        sourceEnterpriseId: enterpriseId,
        documentType: DocumentType.ComeMaterial,
      },
      {
        isInterEnterprise: true,
        targetEnterpriseId: enterpriseId,
        documentTypeForReceiver: DocumentType.ComeMaterial,
        docStatus: { [Op.ne]: DocSTATUS.OPEN },
      },
    ],
  };

  if (enterpriseId !== undefined && enterpriseId !== null) {
    return {
      [Op.and]: [
        dateFilter,
        typeFilter,
        { docStatus: { [Op.ne]: DocSTATUS.DELETED } },
      ],
    };
  }

  return {
    [Op.and]: [
      dateFilter,
      {
        [Op.or]: [
          { documentType: DocumentType.ComeMaterial },
          {
            isInterEnterprise: true,
            documentTypeForReceiver: DocumentType.ComeMaterial,
          },
          { isInterEnterprise: true, documentType: DocumentType.ComeMaterial },
        ],
      },
      { docStatus: { [Op.ne]: DocSTATUS.DELETED } },
    ],
  };
};

export const comeMaterialTmzByArticle = async (
  data: Reference[],
  startDate: number | null,
  endDate: number | null,
  enterpriseId?: number | null,
): Promise<{ reportType: string; values: ComeMaterialTmzValues }> => {
  const emptyValues: ComeMaterialTmzValues = {
    periodStart: startDate,
    periodEnd: endDate,
    materials: [],
    totals: emptyTotals(),
  };

  if (!startDate || !endDate) {
    return { reportType: "COMEMATERIALTMZBYARTICLE", values: emptyValues };
  }

  const materialRefs = new Map<number, Reference>();
  for (const ref of data) {
    if (ref.typeReference !== TypeReference.TMZ || ref.isFolder) continue;
    if (ref.refValues?.typeTMZ !== TypeTMZ.MATERIAL) continue;
    if (ref.id) materialRefs.set(ref.id, ref);
  }

  const documents = await Document.findAll({
    where: buildDocumentWhere(startDate, endDate, enterpriseId),
    attributes: ["id"],
    include: [{ model: DocTableItems, required: false }],
  });

  const aggregate = new Map<
    number,
    ComeMaterialTmzRow & { docIds: Set<string> }
  >();

  for (const doc of documents) {
    const docId = String(doc.id);
    const items = doc.docTableItems ?? [];
    for (const item of items) {
      const materialId = Number(item.analiticId);
      if (!materialId || !materialRefs.has(materialId)) continue;

      const ref = materialRefs.get(materialId)!;
      const count = Number(item.count) || 0;
      const total = Number(item.total) || 0;

      let row = aggregate.get(materialId);
      if (!row) {
        row = {
          materialId,
          materialName: ref.name ?? "",
          article: (ref.article ?? "").trim(),
          unit: ref.refValues?.unit ?? "",
          totalCount: 0,
          totalSum: 0,
          documentsCount: 0,
          linesCount: 0,
          docIds: new Set<string>(),
        };
        aggregate.set(materialId, row);
      }

      row.totalCount += count;
      row.totalSum += total;
      row.linesCount += 1;
      row.docIds.add(docId);
    }
  }

  const materials: ComeMaterialTmzRow[] = Array.from(aggregate.values())
    .map(({ docIds, ...row }) => ({
      ...row,
      totalCount: Math.round(row.totalCount * 1000) / 1000,
      totalSum: Math.round(row.totalSum * 100) / 100,
      documentsCount: docIds.size,
    }))
    .sort((a, b) => {
      const articleCmp = a.article.localeCompare(b.article, "ru");
      if (articleCmp !== 0) return articleCmp;
      return a.materialName.localeCompare(b.materialName, "ru");
    });

  const uniqueArticles = new Set(
    materials.map((m) => m.article).filter((a) => a.length > 0),
  );

  const totals: ComeMaterialTmzTotals = {
    documentsCount: documents.length,
    uniqueMaterials: materials.length,
    uniqueArticles: uniqueArticles.size,
    totalCount:
      Math.round(materials.reduce((s, m) => s + m.totalCount, 0) * 1000) /
      1000,
    totalSum:
      Math.round(materials.reduce((s, m) => s + m.totalSum, 0) * 100) / 100,
  };

  return {
    reportType: "COMEMATERIALTMZBYARTICLE",
    values: {
      periodStart: startDate,
      periodEnd: endDate,
      materials,
      totals,
    },
  };
};
