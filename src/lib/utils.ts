/** Small dependency-free helpers. */

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

export function timeAgo(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export function greetingForHour(hour: number, nickname: string): string {
  const name = nickname?.trim() || 'Traveller';
  if (hour < 5) return `Still awake, ${name}?`;
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  if (hour < 21) return `Good evening, ${name}`;
  return `Late-night story time, ${name}?`;
}

/** Normalize text for search / keyword matching. */
export function norm(s: string): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Split text into keyword tokens (length >= 3, alnum). */
export function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Safe JSON parse returning undefined on failure. */
export function safeParse<T = unknown>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Join URL parts without double slashes. */
export function joinUrl(...parts: string[]): string {
  return parts
    .map((p, i) =>
      i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, ''),
    )
    .filter(Boolean)
    .join('/');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
