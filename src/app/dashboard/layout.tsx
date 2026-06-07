"use client";

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SettingsDropdown from './SettingsDropdown';

const navGroups = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/plan', label: 'Monthly Plan' },
      { href: '/dashboard/yearly', label: 'Yearly Summary' },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem('finplanner-sidebar-pinned');
    if (stored === 'true' || stored === 'false') setSidebarPinned(stored === 'true');
  }, []);

  function togglePinned() {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    window.localStorage.setItem('finplanner-sidebar-pinned', String(next));
    if (!next) setSidebarOpen(false);
  }

  const showPinnedSidebar = sidebarPinned;

  return (
    <div className="min-h-screen flex bg-app-bg text-app-text">
      {(sidebarOpen || showPinnedSidebar) && (
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-background-elevated border-r border-border p-4 transition-transform ${sidebarOpen || showPinnedSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Navigation</p>
            <button
              type="button"
              onClick={togglePinned}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted hover:bg-background"
            >
              {sidebarPinned ? 'Unpin' : 'Pin'}
            </button>
          </div>

          <div className="space-y-3">
            {navGroups.map(group => (
              <div key={group.title} className="rounded-xl border border-border p-2.5">
                <p className="text-xs text-muted mb-2">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map(item => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`block px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary text-background' : 'text-foreground hover:bg-background'}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {sidebarOpen && !showPinnedSidebar && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-background/90 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between gap-6 sticky top-0 z-40">
        <div className="flex items-center gap-6 flex-wrap">
          {!showPinnedSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle menu"
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-border bg-background-elevated text-foreground hover:bg-background"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <div>
            <span className="text-xl font-bold tracking-tight text-foreground">FinPlanner</span>
            <p className="text-[11px] text-muted mt-0.5">Your financial life, simplified and intelligently planned.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SettingsDropdown />
          <UserButton />
        </div>
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
