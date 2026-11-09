// src/lib/builder/access.ts
//
// Remembers which websites a visitor has started on THIS device, together with the secret edit key that opens each one.
// The key lives in localStorage; if that is blocked (private browsing) it falls back to sessionStorage and then memory,
// and callers are told whether it really persisted, so the key is only removed from the address bar when it is safe to.
export interface SavedProject { id: string; key: string; name: string; template: string; at: number }

const LS = 'sys_builder_projects';
const memory: { list: SavedProject[] } = { list: [] };

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const stores = (): Store[] => {
  const out: Store[] = [];
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { const s = window[name]; s.setItem('__t', '1'); s.removeItem('__t'); out.push(s); } catch { /* blocked */ }
  }
  return out;
};

const valid = (p: any): p is SavedProject => !!p && typeof p.id === 'string' && /^PRJ-[A-Z0-9]{6}$/.test(p.id) && typeof p.key === 'string' && p.key.length >= 8 && p.key.length <= 64;

export function listProjects(): SavedProject[] {
  const merged = new Map<string, SavedProject>();
  for (const p of memory.list) merged.set(p.id, p);
  for (const s of stores()) {
    try {
      const arr = JSON.parse(s.getItem(LS) || '[]');
      if (Array.isArray(arr)) for (const p of arr) if (valid(p) && (!merged.has(p.id) || (merged.get(p.id)!.at || 0) < (p.at || 0))) merged.set(p.id, { id: p.id, key: p.key, name: String(p.name || ''), template: String(p.template || ''), at: Number(p.at) || 0 });
    } catch { /* damaged entry: ignore */ }
  }
  return [...merged.values()].sort((a, b) => b.at - a.at);
}

/** Saves (or updates) a project. Returns true when it was stored somewhere that survives a reload. */
export function rememberProject(p: Omit<SavedProject, 'at'> & { at?: number }): boolean {
  if (!valid({ ...p, at: 0 })) return false;
  const entry: SavedProject = { id: p.id, key: p.key, name: p.name || '', template: p.template || '', at: p.at ?? Date.now() };
  // keep a name we already know if the caller does not have one yet
  const known = listProjects().find((x) => x.id === entry.id);
  if (known) { entry.name = entry.name || known.name; entry.template = entry.template || known.template; }
  memory.list = [entry, ...memory.list.filter((x) => x.id !== entry.id)].slice(0, 12);
  const next = [entry, ...listProjects().filter((x) => x.id !== entry.id)].slice(0, 12);
  let persisted = false;
  for (const s of stores()) { try { s.setItem(LS, JSON.stringify(next)); persisted = true; } catch { /* quota */ } }
  return persisted;
}

export function findProject(id: string): SavedProject | undefined { return listProjects().find((p) => p.id === id); }

export function forgetProject(id: string) {
  memory.list = memory.list.filter((p) => p.id !== id);
  const next = listProjects().filter((p) => p.id !== id);
  for (const s of stores()) { try { s.setItem(LS, JSON.stringify(next)); } catch { /* ignore */ } }
}

/** Understands a pasted edit link ("…/builder/edit?id=PRJ-ABC123&key=…") or a bare key. */
export function parseEditLink(input: string, fallbackId = ''): { id: string; key: string } | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const u = new URL(text, 'http://x');
    const id = (u.searchParams.get('id') || fallbackId).toUpperCase();
    const key = u.searchParams.get('key') || '';
    if (/^PRJ-[A-Z0-9]{6}$/.test(id) && key.length >= 8) return { id, key };
  } catch { /* not a link */ }
  if (/^[A-Za-z0-9_-]{8,64}$/.test(text) && /^PRJ-[A-Z0-9]{6}$/.test(fallbackId.toUpperCase())) return { id: fallbackId.toUpperCase(), key: text };
  return null;
}
