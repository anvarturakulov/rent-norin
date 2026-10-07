export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('998') ? digits.slice(3) : digits;
  const d = local.slice(0, 9);
  if (!d) return '';
  if (d.length <= 2) return `+998-${d}`;
  if (d.length <= 5) return `+998-${d.slice(0, 2)}-${d.slice(2)}`;
  if (d.length <= 7) return `+998-${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return `+998-${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7)}`;
}
