import { Op, ModelStatic, Model, Transaction } from "sequelize";
import { TypeReference } from "src/interfaces/reference.interface";

const MAX_ARTICLE_NUMBER = 9999;

export function normalizeTmzArticlePrefix(prefix: string): string {
  const trimmed = prefix.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) {
    throw new Error("Prefix must be exactly 2 Latin letters");
  }
  return trimmed;
}

/**
 * Следующий артикул TMZ вида XX-NNNN.
 * Возвращает минимальный свободный номер (заполняет «дыры»), иначе max + 1.
 */
export async function nextTmzArticleString(
  model: ModelStatic<Model>,
  prefix: string,
  enterpriseId: number | null | undefined,
  excludeReferenceId?: number,
  transaction?: Transaction,
): Promise<string> {
  const normalizedPrefix = normalizeTmzArticlePrefix(prefix);

  const entWhere =
    enterpriseId != null && enterpriseId !== undefined
      ? { enterpriseId }
      : { enterpriseId: { [Op.is]: null } };

  const rows = await model.findAll({
    attributes: ["id", "article"],
    where: {
      ...entWhere,
      typeReference: TypeReference.TMZ,
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
    if (Number.isFinite(num) && num >= 1 && num <= MAX_ARTICLE_NUMBER) {
      used.add(num);
    }
  }

  let next = 1;
  while (used.has(next) && next < MAX_ARTICLE_NUMBER) {
    next++;
  }

  if (used.has(next) || next > MAX_ARTICLE_NUMBER) {
    throw new Error("No free TMZ article numbers in range 1-9999");
  }

  return `${normalizedPrefix}-${String(next).padStart(4, "0")}`;
}
