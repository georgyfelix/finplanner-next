'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('finplanner-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const initial = resolveInitialTheme();
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function setMode(next: ThemeMode) {
    setTheme(next);
    window.localStorage.setItem('finplanner-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setMode('light')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${theme === 'light' ? 'bg-teal-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setMode('dark')}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${theme === 'dark' ? 'bg-teal-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
      >
        Dark
      </button>
    </div>
  );
}
