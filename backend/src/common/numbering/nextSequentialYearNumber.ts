import { Op, Transaction, literal, ModelStatic, Model } from "sequelize";

/**
 * Следующий номер вида 001-YYYY для предприятия и года.
 * Учитываются только строки, полностью совпадающие с шаблоном NNN-YYYY.
 */
export async function nextSequentialYearString(
  model: ModelStatic<Model>,
  numberColumn: "contractNumber" | "orderNumber",
  enterpriseId: number | null | undefined,
  year: number,
  transaction?: Transaction,
): Promise<string> {
  const y = Math.floor(Number(year));
  if (!Number.isFinite(y) || y < 1970 || y > 2100) {
    throw new Error("Invalid year for numbering");
  }

  const entWhere =
    enterpriseId != null && enterpriseId !== undefined
      ? { enterpriseId }
      : { enterpriseId: { [Op.is]: null } };

  const rows = await model.findAll({
    attributes: [numberColumn],
    where: {
      ...entWhere,
      [Op.and]: literal(
        `"${numberColumn}" ~ '^[0-9]{3}-${y}$'`,
      ),
    } as any,
    transaction,
  });

  const re = new RegExp(`^(\\d{3})-${y}$`);
  let max = 0;
  for (const r of rows) {
    const v = String((r as any).get?.(numberColumn) ?? (r as any)[numberColumn] ?? "");
    const m = v.match(re);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${String(max + 1).padStart(3, "0")}-${y}`;
}
