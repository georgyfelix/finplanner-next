'use client';

import { useState, useEffect } from 'react';
import { useUserSettings } from '@/lib/useUserSettings';
import ConfirmModal from '@/app/components/ConfirmModal';

type Account = {
  id: string;
  name: string;
  initialBalance: string;
  currentBalance: number;
  createdAt: string;
  hiddenFromDashboard: boolean;
};
type MonthlyAccountBalance = {
  id: string;
  accountId: string;
  accountName: string;
  month: number;
  year: number;
  openingBalance: string;
  closingBalance: string;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AccountsPage() {
  const now = new Date();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyBalances, setMonthlyBalances] = useState<MonthlyAccountBalance[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { formatMoney, settings } = useUserSettings();

  async function readJsonOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(fallbackMessage);
    }

    let parsed: T | { error?: string };
    try {
      parsed = JSON.parse(text) as T | { error?: string };
    } catch {
      throw new Error(fallbackMessage);
    }

    if (!res.ok) {
      const message = typeof parsed === 'object' && parsed && 'error' in parsed && parsed.error
        ? parsed.error
        : fallbackMessage;
      throw new Error(message);
    }

    return parsed as T;
  }

  async function load() {
    setError('');
    try {
      const [accRes, monthlyRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch(`/api/monthly-account-balances?month=${month}&year=${year}`),
      ]);
      const [accountsData, monthlyData] = await Promise.all([
        readJsonOrThrow<Account[]>(accRes, 'Failed to load accounts'),
        readJsonOrThrow<MonthlyAccountBalance[]>(monthlyRes, 'Failed to load monthly balances'),
      ]);
      setAccounts(accountsData);
      setMonthlyBalances(monthlyData);
    } catch (err) {
      setAccounts([]);
      setMonthlyBalances([]);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    }
  }

  useEffect(() => { load(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, initialBalance: parseFloat(initialBalance) || 0 }),
    });
    if (res.ok) { setName(''); setInitialBalance('0'); await load(); }
    else setError('Failed to create account');
    setLoading(false);
  }

  async function handleUpdateBalance(id: string) {
    await fetch('/api/accounts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, initialBalance: parseFloat(editBalance) || 0 }),
    });
    setEditId(null);
    await load();
  }

  async function handleToggleDashboard(id: string, nextHidden: boolean) {
    await fetch('/api/accounts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hiddenFromDashboard: nextHidden }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeleteId(null);
    await load();
  }

  function updateMonthlyRow(id: string, key: 'openingBalance' | 'closingBalance', value: string) {
    setMonthlyBalances(rows => rows.map(row => (row.id === id ? { ...row, [key]: value } : row)));
  }

  function setClosingFromCurrent(accountId: string) {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;
    const balance = Number(account.currentBalance).toFixed(2);
    setMonthlyBalances(rows => rows.map(row => (row.accountId === accountId ? { ...row, closingBalance: balance } : row)));
  }

  function setAllClosingFromCurrent() {
    setMonthlyBalances(rows =>
      rows.map(row => {
        const account = accounts.find(acc => acc.id === row.accountId);
        return { ...row, closingBalance: Number(account?.currentBalance ?? 0).toFixed(2) };
      })
    );
  }

  async function saveMonthlyBalances() {
    setSavingMonthly(true);
    await Promise.all(
      monthlyBalances.map(row =>
        fetch('/api/monthly-account-balances', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: row.id,
            openingBalance: parseFloat(row.openingBalance) || 0,
            closingBalance: parseFloat(row.closingBalance) || 0,
          }),
        })
      )
    );
    await load();
    setSavingMonthly(false);
  }

  const openingTotal = monthlyBalances.reduce((sum, row) => sum + Number(row.openingBalance), 0);
  const closingTotal = monthlyBalances.reduce((sum, row) => sum + Number(row.closingBalance), 0);

  return (
    <div className="space-y-6">
      <div className="bg-background rounded-xl border p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="text-sm text-muted mt-1">
          Track current balances per bank account. Display currency: {settings?.currency ?? 'USD'}
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-background rounded-xl border p-5 shadow-sm space-y-3">
        <div className="flex gap-3 flex-wrap">
          <input
            className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Account name (e.g. Checking)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.01"
            className="w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Starting balance"
            value={initialBalance}
            onChange={e => setInitialBalance(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Account
          </button>
        </div>
        <p className="text-xs text-muted">Set starting balance to your current real balance so projections are accurate.</p>
      </form>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="bg-background rounded-xl border shadow-sm divide-y">
        {accounts.length === 0 ? (
          <p className="p-5 text-muted text-sm">No accounts yet. Create one above.</p>
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted">
                  Starting: {formatMoney(Number(a.initialBalance))} · Created {new Date(a.createdAt).toLocaleDateString()}
                </p>
                {a.hiddenFromDashboard && (
                  <p className="text-xs text-amber-600 mt-1">Excluded from dashboard totals</p>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <p className={`font-bold text-lg ${a.currentBalance < 0 ? 'text-red-600' : 'text-foreground'}`}>
                    {formatMoney(a.currentBalance)}
                  </p>
                  <p className="text-xs text-muted">current balance</p>
                </div>
                {editId === a.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.01"
                      className="w-28 border rounded-lg px-2 py-1 text-sm"
                      value={editBalance}
                      onChange={e => setEditBalance(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleUpdateBalance(a.id)} className="text-sm text-indigo-600 font-medium hover:underline">Save</button>
                    <button onClick={() => setEditId(null)} className="text-sm text-muted hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditId(a.id); setEditBalance(a.initialBalance); }}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition active:scale-[0.99]"
                  >
                    ✎ Set balance
                  </button>
                )}
                <button onClick={() => setDeleteId(a.id)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition active:scale-[0.99]">
                  🗑 Delete
                </button>
                <button
                  onClick={() => handleToggleDashboard(a.id, !a.hiddenFromDashboard)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-[0.99] ${
                    a.hiddenFromDashboard
                      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {a.hiddenFromDashboard ? '👁 Include in dashboards' : '🙈 Exclude from dashboards'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-background rounded-xl border p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Monthly Account Balances</h2>
            <p className="text-sm text-muted">Manage opening and closing balances per account for each month.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input
              type="number"
              className="border rounded-lg px-3 py-2 text-sm w-24"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={setAllClosingFromCurrent}
            className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm font-medium transition active:scale-[0.99]"
          >
            Set All Closing = Current
          </button>
          <button
            type="button"
            onClick={saveMonthlyBalances}
            disabled={savingMonthly || monthlyBalances.length === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition active:scale-[0.99]"
          >
            Save Monthly Balances
          </button>
        </div>

        {monthlyBalances.length === 0 ? (
          <p className="text-sm text-muted">No accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-muted">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Account</th>
                  <th className="text-right px-3 py-2 font-medium">Opening</th>
                  <th className="text-right px-3 py-2 font-medium">Closing</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthlyBalances.map(row => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium">{row.accountName}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-32 text-right border rounded-lg px-2 py-1"
                        value={row.openingBalance}
                        onChange={e => updateMonthlyRow(row.id, 'openingBalance', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-32 text-right border rounded-lg px-2 py-1"
                        value={row.closingBalance}
                        onChange={e => updateMonthlyRow(row.id, 'closingBalance', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setClosingFromCurrent(row.accountId)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background-elevated hover:bg-background-elevated text-foreground text-xs font-semibold transition active:scale-[0.99]"
                      >
                        Use Current
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-background-elevated font-semibold border-t-2">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{formatMoney(openingTotal)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(closingTotal)}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete account?"
        message="This removes the account and all related transactions. This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}

