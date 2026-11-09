// src/lib/safeStorage.ts
//
// localStorage / sessionStorage throw in some situations (Safari private mode, blocked site data,
// storage full, SSR). Every access in the site goes through here so a storage failure can never
// crash a page.

type Kind = 'local' | 'session';

function store(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function make(kind: Kind) {
  return {
    get(key: string): string | null {
      try {
        return store(kind)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): boolean {
      try {
        store(kind)?.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key: string): void {
      try {
        store(kind)?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    getJSON<T>(key: string, fallback: T): T {
      try {
        const raw = store(kind)?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    setJSON(key: string, value: unknown): boolean {
      try {
        store(kind)?.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const safeLocal = make('local');
export const safeSession = make('session');
