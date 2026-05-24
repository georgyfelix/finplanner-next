'use client';

import { useEffect, useState, useCallback } from 'react';

type Settings = {
  userId: string;
  locale: string;
  currency: string;
};

export function useUserSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    setSettings(await res.json());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const formatMoney = useCallback(
    (value: number) => {
      const currency = settings?.currency ?? 'USD';
      const locale = settings?.locale ?? 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    },
    [settings]
  );

  return {
    settings,
    reload,
    formatMoney,
  };
}
