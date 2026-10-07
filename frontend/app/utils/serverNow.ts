let offsetMs = 0;
let syncStarted = false;

export function nowMs(): number {
  return Date.now() + offsetMs;
}

export function getServerTimeOffsetMs(): number {
  return offsetMs;
}

export function setServerTimeOffsetMs(value: number): void {
  if (!Number.isFinite(value)) return;
  offsetMs = value;
}

export async function syncServerNow(): Promise<void> {
  const domain = process.env.NEXT_PUBLIC_DOMAIN;
  if (!domain) return;
  const clientBefore = Date.now();
  try {
    const response = await fetch(`${domain}/api/time`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const serverNow = Number(data?.now);
    if (!Number.isFinite(serverNow) || serverNow <= 0) return;
    const clientAfter = Date.now();
    const clientMid = Math.round((clientBefore + clientAfter) / 2);
    offsetMs = serverNow - clientMid;
  } catch {
    // keep last offset / zero
  }
}

export function ensureServerNowSynced(): void {
  if (syncStarted) return;
  syncStarted = true;
  void syncServerNow();
}
