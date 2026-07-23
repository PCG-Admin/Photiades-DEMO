'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/i18n';

export type Density = 'compact' | 'comfortable' | 'spacious';
export interface ThemeState {
  accentHue: number;
  density: Density;
  dark: boolean;
  lang: Lang;
}

export const THEME_DEFAULTS: ThemeState = {
  accentHue: 255,
  density: 'comfortable',
  dark: false,
  lang: 'en',
};

const STORAGE_KEY = 'pcg-theme';

interface ThemeContextValue {
  t: ThemeState;
  setTweak: <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ t: THEME_DEFAULTS, setTweak: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<ThemeState>(THEME_DEFAULTS);
  const hydrated = useRef(false);

  // Pull any persisted preference once, after mount (keeps SSR === first client render).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Sync from persisted storage once on mount (kept out of the initial
      // render so SSR markup matches the first client render).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setT(prev => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Apply tweaks to :root and persist.
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent-h', String(t.accentHue));
    r.style.setProperty('--density', t.density === 'compact' ? '0.85' : t.density === 'comfortable' ? '1' : '1.12');
    r.setAttribute('data-theme', t.dark ? 'dark' : 'light');
    r.lang = t.lang === 'el' ? 'el' : 'en';
    if (hydrated.current) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* ignore */ }
    }
  }, [t]);

  const setTweak: ThemeContextValue['setTweak'] = (key, value) => setT(prev => ({ ...prev, [key]: value }));

  return <ThemeContext.Provider value={{ t, setTweak }}>{children}</ThemeContext.Provider>;
}
