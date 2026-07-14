/* ─────────────────────────────────────────────────────────────
   Safe localStorage helpers — never throw on corrupt JSON,
   and debounced write so rapid edits don't hammer storage.
   ───────────────────────────────────────────────────────────── */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    // corrupt or partial data — reset to fallback so the app still loads
    try { localStorage.removeItem(key); } catch {}
    return fallback;
  }
}

/* Debounced per-key writer: coalesces bursty updates (one per keystroke)
   into a single write after `delay` ms of quiet. Returns a cancel fn. */
type Pending = { timer: ReturnType<typeof setTimeout> | null };
const pending = new Map<string, Pending>();

export function saveJSON(key: string, value: unknown, delay = 300): void {
  let entry = pending.get(key);
  if (!entry) {
    entry = { timer: null };
    pending.set(key, entry);
  }
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or private mode — silently drop; nothing to recover to.
    }
    pending.delete(key);
  }, delay);
}

export function saveJSONNow(key: string, value: unknown): void {
  const entry = pending.get(key);
  if (entry?.timer) clearTimeout(entry.timer);
  pending.delete(key);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
