'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const navGroups = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/plan', label: 'Monthly Plan' },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/dashboard/accounts', label: 'Accounts' },
      { href: '/dashboard/transactions', label: 'Transactions' },
      { href: '/dashboard/budgets', label: 'Budgets' },
      { href: '/dashboard/categories', label: 'Categories' },
    ],
  },
];

export default function NavDropdown() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Menu
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <div className="absolute right-0 mt-2 w-[340px] z-50 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Navigation</p>
            {navGroups.map(group => (
              <div key={group.title} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{group.title}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
