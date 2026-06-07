'use client';

import { useEffect, useState } from 'react';
import { useUserSettings } from '@/lib/useUserSettings';

type ThemeMode = 'light' | 'dark';

const CURRENCY_OPTIONS = [
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
];

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('finplanner-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function SettingsDropdown() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const { settings, reload } = useUserSettings();

  useEffect(() => {
    const initial = resolveInitialTheme();
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function setMode(next: ThemeMode) {
    setTheme(next);
    window.localStorage.setItem('finplanner-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  async function handleCurrencyChange(currency: string) {
    setSavingCurrency(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency,
        locale: settings?.locale ?? 'en-US',
      }),
    });
    await reload();
    setSavingCurrency(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Open settings"
        className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-border bg-background-elevated text-foreground hover:bg-background"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.64.86 1.05 1.56 1H21a2 2 0 1 1 0 4h-.09c-.7 0-1.32.41-1.56 1Z" />
        </svg>
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="Close settings" />
          <div className="absolute right-0 mt-2 w-[340px] z-50 rounded-2xl border border-border bg-background shadow-2xl p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Appearance</p>
              <div className="flex items-center rounded-xl border border-border bg-background-elevated p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setMode('light')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${theme === 'light' ? 'bg-primary text-background' : 'text-muted hover:bg-background'}`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setMode('dark')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${theme === 'dark' ? 'bg-primary text-background' : 'text-muted hover:bg-background'}`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Currency</p>
              <select
                className="w-full border border-border rounded-lg px-2.5 py-2 text-sm text-foreground bg-background-elevated"
                value={settings?.currency ?? 'USD'}
                onChange={e => handleCurrencyChange(e.target.value)}
                disabled={savingCurrency}
              >
                {CURRENCY_OPTIONS.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
