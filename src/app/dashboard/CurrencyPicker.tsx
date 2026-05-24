'use client';

import { useState } from 'react';
import { useUserSettings } from '@/lib/useUserSettings';

const CURRENCY_OPTIONS = [
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
];

export default function CurrencyPicker() {
  const { settings, reload } = useUserSettings();
  const [saving, setSaving] = useState(false);

  async function handleChange(currency: string) {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency,
        locale: settings?.locale ?? 'en-US',
      }),
    });
    await reload();
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">Currency</span>
      <select
        className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
        value={settings?.currency ?? 'USD'}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
      >
        {CURRENCY_OPTIONS.map(option => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
