export type ThemePreference = 'light' | 'dark' | 'auto';

export const THEME_STORAGE_KEY = 'akshara-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch {
    // Storage may be unavailable (private mode, sandboxed iframe)
  }
  return 'auto';
}

export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  const dark = resolveIsDark(pref);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.theme = pref;
}

const preferenceListeners = new Set<() => void>();

/** Persist + apply a new preference and notify every subscribed ThemeToggle. */
export function setThemePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  applyTheme(pref);
  preferenceListeners.forEach((listener) => listener());
}

/** useSyncExternalStore subscription for the saved preference (also syncs across tabs). */
export function subscribeToThemePreference(onChange: () => void): () => void {
  preferenceListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    preferenceListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Subscribe to OS light/dark changes (only matters while the preference is "auto"). */
export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Inline pre-paint script for <head>: applies the saved theme before React hydrates,
 * so there is no light→dark flash on load.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='light'&&p!=='dark')p='auto';var d=p==='dark'||(p==='auto'&&window.matchMedia('${DARK_QUERY}').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.dataset.theme=p;}catch(e){}})();`;
