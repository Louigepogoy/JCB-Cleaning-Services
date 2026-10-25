import { useEffect, useState } from 'react';

export function initialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // keep multiple toggles on screen in sync
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme || 'light');
    window.addEventListener('theme-change', sync);
    return () => window.removeEventListener('theme-change', sync);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <button className={`icon-btn ${className}`} onClick={toggle} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
