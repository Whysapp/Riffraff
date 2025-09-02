export type CachedPayload = {
  analysis: any;
  tab: string[];
  ts: number;
  version: number;
};

const CACHE_VERSION = 1;

export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return hexOfArrayBuffer(digest);
}

export async function hashString(text: string): Promise<string> {
  const enc = new TextEncoder();
  return hashBuffer(enc.encode(text).buffer);
}

function hexOfArrayBuffer(ab: ArrayBuffer): string {
  const arr = new Uint8Array(ab);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function makeCacheKey(parts: Array<string>): string {
  return `tabcraft:${CACHE_VERSION}:${parts.join('|')}`;
}

export function getCache(key: string): CachedPayload | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCache(key: string, payload: Omit<CachedPayload, 'version' | 'ts'>) {
  const toStore: CachedPayload = { ...payload, ts: Date.now(), version: CACHE_VERSION } as CachedPayload;
  try {
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch {}
}

export function clearAllCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith('tabcraft:')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

