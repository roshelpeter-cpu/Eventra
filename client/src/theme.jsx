import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'eventra-theme';
const ThemeContext = createContext(null);

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function ThemeProvider({ children }) {
  const [explicit, setExplicit] = useState(() => Boolean(storedTheme()));
  const [theme, setThemeState] = useState(() => storedTheme() || systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#070b16' : '#f5f7fb');
    if (explicit) localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, explicit]);

  useEffect(() => {
    if (explicit) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setThemeState(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [explicit]);

  function setTheme(next) {
    setExplicit(true);
    setThemeState(next);
  }

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
