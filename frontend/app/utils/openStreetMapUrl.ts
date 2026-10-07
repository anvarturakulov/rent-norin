/** Парсинг JSON локации из бота: `{"latitude":...,"longitude":...}` */
export function parsePartnerLocationLatLon(
  raw: string | undefined | null,
): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const o = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown };
    const lat = Number(o.latitude);
    const lon = Number(o.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  } catch {
    /* ignore */
  }
  return null;
}

/** Центр карты OpenStreetMap (веб), zoom по умолчанию — улица/квартал */
export function openStreetMapUrl(
  lat: number,
  lon: number,
  zoom = 17,
): string {
  const z = Math.min(19, Math.max(1, Math.round(zoom)));
  return `https://www.openstreetmap.org/#map=${z}/${lat}/${lon}`;
}
