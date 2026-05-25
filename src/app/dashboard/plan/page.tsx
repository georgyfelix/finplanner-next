'use client';

import { useState, useEffect, useCallback } from 'react';
import { CategorySelect } from '@/lib/useCategories';
import { useUserSettings } from '@/lib/useUserSettings';
import ConfirmModal from '@/app/components/ConfirmModal';

type Account = { id: string; name: string; initialBalance: string; currentBalance: number; hiddenFromDashboard: boolean };
type Transaction = {
  id: string;
  accountId: string | null;
  amount: string;
  category: string;
  date: string;
  plannedDate: string | null;
  isPlanned: boolean;
  origin: string;
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
type Category = { id: string; name: string; type: string };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text) return [] as T;
  return JSON.parse(text) as T;
}

export default function PlanPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyAccountBalances, setMonthlyAccountBalances] = useState<MonthlyAccountBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { formatMoney, settings } = useUserSettings();
  const [form, setForm] = useState({
    amount: '',
    category: '',
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  });
  const [settleId, setSettleId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState({ accountId: '', amount: '', category: '', date: '' });
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    const [accRes, monthlyAccRes, catRes, txRes] = await Promise.all([
      fetch('/api/accounts'),
      fetch(`/api/monthly-account-balances?month=${month}&year=${year}`),
      fetch('/api/categories'),
      fetch('/api/transactions'),
    ]);
    const accs: Account[] = await readJsonOrThrow(accRes);
    const monthlyAccRows: MonthlyAccountBalance[] = await readJsonOrThrow(monthlyAccRes);
    const catRows: Category[] = await readJsonOrThrow(catRes);
    const txs: Transaction[] = await readJsonOrThrow(txRes);
    setAccounts(accs);
    setMonthlyAccountBalances(monthlyAccRows);
    setCategories(catRows);
    setTransactions(txs);
  }, [month, year]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Planned transactions still pending (isPlanned=true) for the selected month — shown in the list
  const plannedThisMonth = transactions
    .filter(t => {
      if (!t.isPlanned) return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ALL planned-origin transactions for the month (pending + settled) — used for projection
  // Uses plannedDate when available so settling with a different actual date doesn't shift the month.
  const allPlannedThisMonth = transactions.filter(t => {
    if (t.origin !== 'planned') return false;
    const anchor = t.plannedDate ?? t.date;
    const d = new Date(anchor);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const actualThisMonth = transactions.filter(t => {
    if (t.isPlanned) return false;
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const visibleAccounts = accounts.filter(account => !account.hiddenFromDashboard);
  const visibleAccountIds = new Set(visibleAccounts.map(account => account.id));
  const visibleMonthlyAccountBalances = monthlyAccountBalances.filter(row => visibleAccountIds.has(row.accountId));

  const categoryTypeByName = new Map(categories.map(c => [c.name, c.type]));
  const normalizeAmount = (tx: Transaction) => {
    const raw = Number(tx.amount);
    const type = categoryTypeByName.get(tx.category);
    if (type === 'income') return Math.abs(raw);
    if (type === 'expense' || type === 'saving') return -Math.abs(raw);
    return raw;
  };
  const plannedNet = plannedThisMonth.reduce((sum, t) => sum + normalizeAmount(t), 0);
  const actualNet = actualThisMonth.reduce((sum, t) => sum + normalizeAmount(t), 0);
  const unplannedExpenses = actualThisMonth
    .filter(t => t.origin !== 'planned' && normalizeAmount(t) < 0)
    .reduce((sum, t) => sum + Math.abs(normalizeAmount(t)), 0);
  const totalMonthlyOpening = visibleMonthlyAccountBalances.reduce((sum, row) => sum + Number(row.openingBalance), 0);
  // Use ALL planned-origin (settled + pending) so projection is stable regardless of settlement status
  const plannedIncomeTotal = allPlannedThisMonth
    .filter(t => categoryTypeByName.get(t.category) === 'income')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const plannedExpenseTotal = allPlannedThisMonth
    .filter(t => categoryTypeByName.get(t.category) === 'expense')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const plannedSavingTotal = allPlannedThisMonth
    .filter(t => categoryTypeByName.get(t.category) === 'saving')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const plannedOutflowTotal = plannedExpenseTotal + plannedSavingTotal;
  const totalPlannedNet = plannedIncomeTotal - plannedOutflowTotal;
  // Opening already includes salary credit from rollover — only subtract outflows for projection.
  const projectedClosing = totalMonthlyOpening - plannedOutflowTotal;
  const totalCurrentBalance = visibleAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const unaccounted = totalCurrentBalance - projectedClosing;

  async function handleAddPlanned(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), isPlanned: true, origin: 'planned' }),
    });
    setForm(f => ({ ...f, amount: '' }));
    await loadAll();
    setLoading(false);
  }

  function openSettle(tx: Transaction) {
    setSettleId(tx.id);
    setSettleForm({
      accountId: tx.accountId ?? accounts[0]?.id ?? '',
      amount: String(Math.abs(normalizeAmount(tx))),
      category: tx.category,
      date: tx.date,
    });
  }

  async function handleSettle(id: string) {
    if (!settleForm.accountId) return;
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPlanned: false,
        accountId: settleForm.accountId,
        amount: parseFloat(settleForm.amount),
        category: settleForm.category,
        date: settleForm.date,
      }),
    });
    setSettleId(null);
    await loadAll();
  }

  async function handleDelete(id: string) {
    await fetch('/api/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setDeleteId(null);
    await loadAll();
  }

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? id;
  const fmtAmt = (n: number) => `${n >= 0 ? '+' : ''}${formatMoney(Math.abs(n))}`;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Monthly Plan</h1>
            <p className="text-sm text-gray-500 mt-1">
              Set start balance and income, add account-agnostic planned items, then settle to actual with account and final amount.
            </p>
          </div>
          <p className="text-sm text-gray-500">Currency: {settings?.currency ?? 'USD'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 items-center">
          <select
            className="border rounded-lg px-3 py-1.5 text-sm"
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input
            type="number"
            className="border rounded-lg px-3 py-1.5 text-sm w-20"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="font-semibold text-sm text-gray-700">Monthly Report Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 text-sm">
          <div>
            <p className="text-gray-500">Opening (dashboard accounts)</p>
            <p className="font-semibold">{formatMoney(totalMonthlyOpening)}</p>
          </div>
          <div>
            <p className="text-gray-500">Planned income</p>
            <p className="font-semibold text-green-700">+{formatMoney(plannedIncomeTotal)}</p>
          </div>
          <div>
            <p className="text-gray-500">Planned expenses</p>
            <p className="font-semibold text-red-600">{formatMoney(plannedExpenseTotal)}</p>
          </div>
          <div>
            <p className="text-gray-500">Planned savings</p>
            <p className="font-semibold text-amber-600">{formatMoney(plannedSavingTotal)}</p>
          </div>
          <div>
            <p className="text-gray-500">Planned remaining (pending)</p>
            <p className={`font-semibold ${plannedNet < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtAmt(plannedNet)}</p>
          </div>
          <div>
            <p className="text-gray-500">Projected closing</p>
            <p className={`font-semibold text-lg ${projectedClosing < 0 ? 'text-red-600' : 'text-indigo-700'}`}>{formatMoney(projectedClosing)}</p>
          </div>
          <div>
            <p className="text-gray-500">Current balance (dashboard accounts)</p>
            <p className="font-semibold">{formatMoney(totalCurrentBalance)}</p>
            {visibleAccounts.length !== accounts.length && (
              <p className="text-xs text-amber-600 mt-1">Hidden accounts are excluded here.</p>
            )}
          </div>
        </div>
        {/* Unaccounted gap */}
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm border ${
          unaccounted < -500 ? 'bg-red-50 border-red-200 text-red-700'
          : unaccounted > 500 ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}>
          {unaccounted < -500 ? (
            <span>
              <span className="font-semibold">Unaccounted gap: {formatMoney(Math.abs(unaccounted))}</span> — your current balance is less than projected. This money was likely spent but not logged or planned.
            </span>
          ) : unaccounted > 500 ? (
            <span>
              <span className="font-semibold">Surplus: {formatMoney(Math.abs(unaccounted))}</span> — your current balance is higher than projected. Likely an income or transfer not yet planned.
            </span>
          ) : (
            <span className="font-semibold">Balances match projected closing. All expenses appear accounted for.</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-sm text-gray-700">
            Account Balances (Actual) — {MONTHS[month - 1]} {year}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Planned items are account-agnostic and do not affect an individual account until settled.
          </p>
        </div>
        {visibleAccounts.length === 0 ? (
          <p className="p-5 text-gray-400 text-sm">No dashboard-visible accounts. Manage visibility in Accounts.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Account</th>
                <th className="text-right px-4 py-2 font-medium">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleAccounts.map(acc => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{acc.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatMoney(acc.currentBalance)}
                  </td>
                </tr>
              ))}
              {visibleAccounts.length > 1 && (
                <tr className="bg-gray-50 font-semibold text-sm border-t-2">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(visibleAccounts.reduce((s, a) => s + a.currentBalance, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Planned transactions list */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-gray-700">
              Planned Transactions — {MONTHS[month - 1]} {year}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Settle with account + final amount when the transaction actually happens.</p>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {plannedThisMonth.length} planned
          </span>
        </div>
        {plannedThisMonth.length === 0 ? (
          <p className="p-5 text-gray-400 text-sm">No planned transactions for {MONTHS[month - 1]} {year}. Add one below.</p>
        ) : (
          <ul className="divide-y">
            {plannedThisMonth.map(tx => (
              <li key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{tx.category}</p>
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold text-sm ${normalizeAmount(tx) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {fmtAmt(normalizeAmount(tx))}
                  </span>
                  <button
                    onClick={() => openSettle(tx)}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition active:scale-[0.99]"
                  >
                    ✔ Settle
                  </button>
                  <button onClick={() => setDeleteId(tx.id)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition active:scale-[0.99]">
                    🗑 Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

        {/* Settle modal */}
        {settleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setSettleId(null)} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl border shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base text-gray-800">Settle Planned Transaction</h2>
                <button onClick={() => setSettleId(null)} className="text-sm text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <p className="text-xs text-gray-400">Select the account and confirm final amount, category and date.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Account</label>
                  <select
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.accountId}
                    onChange={e => setSettleForm(f => ({ ...f, accountId: e.target.value }))}
                    required
                  >
                    {accounts.length === 0 && <option value="">No accounts</option>}
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Amount</label>
                  <input
                    type="number" step="0.01"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.amount}
                    onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Final amount"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Category</label>
                  <input
                    type="text"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.category}
                    onChange={e => setSettleForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Category"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Actual date</label>
                  <input
                    type="date"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.date}
                    onChange={e => setSettleForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setSettleId(null)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition active:scale-[0.99]">Cancel</button>
                <button
                  onClick={() => handleSettle(settleId)}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99]"
                >
                  Save Actual
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Add planned transaction */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-1">Add Planned Transaction</h2>
        <p className="text-xs text-gray-400 mb-4">Plan a future income or expense without binding to an account.</p>
        <form onSubmit={handleAddPlanned} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input
            type="number"
            step="0.01"
            placeholder="Amount (sign auto-set by category)"
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            required
          />
          <CategorySelect
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={v => setForm(f => ({ ...f, category: v }))}
          />
          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="col-span-2 sm:col-span-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Planned Transaction
          </button>
        </form>
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete planned transaction?"
        message="This will remove the planned item from this month."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
