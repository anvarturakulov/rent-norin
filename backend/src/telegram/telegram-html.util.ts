export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatMoneyRu(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatWorkerSalaryBalanceLine(
  balance: number,
  currency = "so'm",
): string {
  if (balance < 0) {
    return `Қарз: <b>${formatMoneyRu(Math.abs(balance))}</b> ${currency}`;
  }
  return `Колдик: <b>${formatMoneyRu(balance)}</b> ${currency}`;
}

export function formatDateTimeRu(timestamp?: number | null): string {
  if (!timestamp) return "—";
  return new Date(Number(timestamp)).toLocaleString("ru-RU");
}

export function formatDateRu(timestamp?: number | null): string {
  if (!timestamp) return "—";
  return new Date(Number(timestamp)).toLocaleDateString("ru-RU");
}

/** dd.MM.yy — компактно для таблиц в Telegram */
export function formatDateShortRu(timestamp?: number | null): string {
  if (!timestamp) return "—";
  const d = new Date(Number(timestamp));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function padEndPlain(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}

function padStartPlain(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return " ".repeat(width - value.length) + value;
}

export interface TelegramPlainTableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** Моноширинная таблица для блока &lt;pre&gt; в Telegram HTML */
export function formatTelegramPlainTable(
  columns: TelegramPlainTableColumn[],
  rows: string[][],
): string {
  const pad = (value: string, col: TelegramPlainTableColumn) =>
    col.align === "right"
      ? padStartPlain(value, col.width)
      : padEndPlain(value, col.width);

  const header = columns.map((col) => pad(col.header, col)).join(" ");
  const separator = "─".repeat(
    columns.reduce((sum, col) => sum + col.width, 0) + columns.length - 1,
  );
  const body = rows.map((row) =>
    columns
      .map((col, index) => pad(row[index] ?? "", col))
      .join(" "),
  );

  return [header, separator, ...body].join("\n");
}
