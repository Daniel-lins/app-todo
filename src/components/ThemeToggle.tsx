'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import { 
  ThemeMode, 
  getEffectiveTheme, 
  getSavedTheme, 
  applyTheme 
} from '../utils/theme';

const emptySubscribe = () => () => {};

export const ThemeToggle: React.FC = () => {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    return getEffectiveTheme();
  });

  useEffect(() => {
    // Observa mudanças na preferência do sistema se o usuário não tiver escolha explícita salva
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const explicit = getSavedTheme();
      if (!explicit) {
        const newTheme: ThemeMode = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        applyTheme(newTheme, false);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme, true);
  };

  // Enquanto não hidrata no cliente, renderiza um botão estático para evitar divergência
  const isDark = isClient ? theme === 'dark' : true;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-500 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
};
