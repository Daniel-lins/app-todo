export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'apptodo_theme';

/**
 * Retorna a preferência de tema salva pelo usuário em localStorage (se houver).
 */
export function getSavedTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // LocalStorage indisponível ou com restrição
  }
  return null;
}

/**
 * Consulta a preferência do sistema operacional via media query prefers-color-scheme.
 */
export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

/**
 * Determina o tema efetivo: preferência explícita se houver, ou preferência do sistema.
 */
export function getEffectiveTheme(): ThemeMode {
  const saved = getSavedTheme();
  if (saved) return saved;
  return getSystemTheme();
}

/**
 * Aplica o tema na árvore DOM (classes, atributos e colorScheme) e persiste se for explícito.
 */
export function applyTheme(theme: ThemeMode, isExplicit = false): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = theme === 'dark';

  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  if (isExplicit) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Falha silenciosa em ambientes com armazenamento restrito
    }
  }
}

/**
 * Limpa a preferência explícita, voltando a acompanhar dinamicamente o tema do sistema.
 */
export function clearExplicitTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
    applyTheme(getSystemTheme(), false);
  } catch {
    // Armazenamento restrito
  }
}

/**
 * Script inline injetado no <head> para garantir renderização instantânea do tema
 * correto antes do primeiro paint, eliminando qualquer flash de tema incorreto (FOUC).
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  } catch(e) {}
})();
`;
