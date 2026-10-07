import { Op, ModelStatic, Model, Transaction } from "sequelize";
import { TypeReference } from "src/interfaces/reference.interface";

const MAX_WORKS_ARTICLE_NUMBER = 999;

/** Группа артикула работ: G + 3 цифры (G006, G005). */
export function normalizeWorksArticlePrefix(prefix: string): string {
  const trimmed = prefix.trim().toUpperCase();
  if (!/^G\d{3}$/.test(trimmed)) {
    throw new Error("Prefix must be G followed by 3 digits (e.g. G006)");
  }
  return trimmed;
}

/**
 * Следующий артикул WORKS вида G006-032.
 * Возвращает минимальный свободный номер (заполняет «дыры»), иначе max + 1.
 */
export async function nextWorksArticleString(
  model: ModelStatic<Model>,
  prefix: string,
  enterpriseId: number | null | undefined,
  excludeReferenceId?: number,
  transaction?: Transaction,
): Promise<string> {
  const normalizedPrefix = normalizeWorksArticlePrefix(prefix);

  const entWhere =
    enterpriseId != null && enterpriseId !== undefined
      ? { enterpriseId }
      : { enterpriseId: { [Op.is]: null } };

  const rows = await model.findAll({
    attributes: ["id", "article"],
    where: {
      ...entWhere,
      typeReference: TypeReference.WORKS,
      article: { [Op.iLike]: `${normalizedPrefix}-%` },
    } as any,
    transaction,
  });

  const suffixRe = new RegExp(`^${normalizedPrefix}-(\\d+)$`, "i");
  const used = new Set<number>();

  for (const row of rows) {
    const id = (row as any).get?.("id") ?? (row as any).id;
    if (excludeReferenceId != null && id === excludeReferenceId) {
      continue;
    }
    const article = String(
      (row as any).get?.("article") ?? (row as any).article ?? "",
    ).trim();
    const m = article.match(suffixRe);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (
      Number.isFinite(num) &&
      num >= 1 &&
      num <= MAX_WORKS_ARTICLE_NUMBER
    ) {
      used.add(num);
    }
  }

  let next = 1;
  while (used.has(next) && next < MAX_WORKS_ARTICLE_NUMBER) {
    next++;
  }

  if (used.has(next) || next > MAX_WORKS_ARTICLE_NUMBER) {
    throw new Error("No free WORKS article numbers in range 1-999");
  }

  return `${normalizedPrefix}-${String(next).padStart(3, "0")}`;
}
