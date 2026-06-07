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
  const [editId, setEditId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState({ accountId: '', amount: '', category: '', date: '' });
  const [editForm, setEditForm] = useState({ amount: '', category: '', date: '' });
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
  const trueStartingBalance = totalMonthlyOpening - plannedIncomeTotal;
  const totalCurrentBalance = visibleAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  
  // Calculate unplanned spending dynamically based on actual balance changes
  const pendingPlannedOutflows = plannedThisMonth
    .filter(t => categoryTypeByName.get(t.category) === 'expense' || categoryTypeByName.get(t.category) === 'saving')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const settledPlannedOutflows = plannedOutflowTotal - pendingPlannedOutflows;

  // Unplanned Expense = True Start + Planned Income - Settled Planned Outflows - Current Balance
  const derivedUnplannedExpense = trueStartingBalance + plannedIncomeTotal - settledPlannedOutflows - totalCurrentBalance;
  
  // Projected Closing = What we have in the bank right now + What we still expect to happen
  const projectedClosing = totalCurrentBalance + plannedNet;

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

  async function handleCopyPreviousMonth() {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const toCopy = transactions.filter(t => {
      if (t.origin !== 'planned') return false;
      const anchor = t.plannedDate ?? t.date;
      const d = new Date(anchor);
      return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear;
    });

    if (toCopy.length === 0) {
      alert('No planned transactions found in the previous month.');
      return;
    }

    setLoading(true);
    for (const tx of toCopy) {
      const originalDate = new Date(tx.date);
      let newDay = originalDate.getDate();
      const daysInCurrentMonth = new Date(year, month, 0).getDate();
      if (newDay > daysInCurrentMonth) newDay = daysInCurrentMonth;
      
      const newDateStr = `${year}-${String(month).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.abs(Number(tx.amount)),
          category: tx.category,
          date: newDateStr,
          isPlanned: true,
          origin: 'planned'
        }),
      });
    }
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

  function openEdit(tx: Transaction) {
    setEditId(tx.id);
    setEditForm({
      amount: String(Math.abs(normalizeAmount(tx))),
      category: tx.category,
      date: tx.plannedDate ?? tx.date,
    });
  }

  async function handleEdit(id: string) {
    setLoading(true);
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: editForm.date,
        plannedDate: editForm.date
      }),
    });
    setEditId(null);
    await loadAll();
    setLoading(false);
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
      <div className="bg-background rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Monthly Plan</h1>
            <p className="text-sm text-muted mt-1">
              Set start balance and income, add account-agnostic planned items, then settle to actual with account and final amount.
            </p>
          </div>
          <p className="text-sm text-muted">Currency: {settings?.currency ?? 'USD'}</p>
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

      <div className="bg-background rounded-xl border p-5 shadow-sm space-y-6">
        <div>
          <h2 className="font-semibold text-sm text-foreground mb-3">1. The Overall Plan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 bg-background-elevated rounded-lg border border-border">
              <p className="text-muted text-xs mb-1">Planned Income</p>
              <p className="font-semibold text-green-600">+{formatMoney(plannedIncomeTotal)}</p>
            </div>
            <div className="p-3 bg-background-elevated rounded-lg border border-border">
              <p className="text-muted text-xs mb-1">Planned Outflows</p>
              <p className="font-semibold text-red-500">{formatMoney(plannedOutflowTotal)}</p>
              <p className="text-[10px] text-muted mt-0.5">Exp: {formatMoney(plannedExpenseTotal)} | Sav: {formatMoney(plannedSavingTotal)}</p>
            </div>
            <div className="p-3 bg-background-elevated rounded-lg border border-border">
              <p className="text-muted text-xs mb-1">Monthly Net (Surplus)</p>
              <p className={`font-semibold ${totalPlannedNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalPlannedNet >= 0 ? '+' : ''}{formatMoney(totalPlannedNet)}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <h2 className="font-semibold text-sm text-foreground mb-3">2. The Reality</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div className="p-3 bg-background-elevated rounded-lg border border-border">
              <p className="text-muted text-xs mb-1">Current Balance</p>
              <p className="font-semibold">{formatMoney(totalCurrentBalance)}</p>
              {visibleAccounts.length !== accounts.length && (
                <p className="text-[10px] text-amber-600 mt-0.5">Excludes hidden accounts</p>
              )}
            </div>
            <div className="p-3 bg-background-elevated rounded-lg border border-border">
              <p className="text-muted text-xs mb-1">Remaining Planned</p>
              <p className={`font-semibold ${plannedNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatMoney(Math.abs(plannedNet))}
              </p>
              <p className="text-[10px] text-muted mt-0.5">Yet to be settled</p>
            </div>
            <div className={`p-3 rounded-lg border ${Math.abs(derivedUnplannedExpense) < 0.01 ? 'bg-background-elevated border-border' : derivedUnplannedExpense > 0 ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/50' : 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50'}`}>
              <p className={`text-xs mb-1 font-medium ${Math.abs(derivedUnplannedExpense) < 0.01 ? 'text-muted' : derivedUnplannedExpense > 0 ? 'text-orange-800 dark:text-orange-300' : 'text-green-800 dark:text-green-300'}`}>Unplanned Expenses</p>
              <p className={`font-bold text-lg ${Math.abs(derivedUnplannedExpense) < 0.01 ? 'text-foreground' : derivedUnplannedExpense > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {Math.abs(derivedUnplannedExpense) < 0.01 ? formatMoney(0) : `${derivedUnplannedExpense < 0 ? '+' : ''}${formatMoney(Math.abs(derivedUnplannedExpense))}`}
              </p>
              <p className={`text-[10px] mt-0.5 ${Math.abs(derivedUnplannedExpense) < 0.01 ? 'text-muted' : derivedUnplannedExpense > 0 ? 'text-orange-600/70 dark:text-orange-400/70' : 'text-green-600/70 dark:text-green-400/70'}`}>
                {Math.abs(derivedUnplannedExpense) < 0.01 ? 'No unexpected changes' : 'Derived from balances'}
              </p>
            </div>
            <div className="p-3 bg-sky-50/50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/50 rounded-lg border">
              <p className="text-sky-900 dark:text-sky-300 text-xs mb-1 font-medium">Settled Payments</p>
              <p className="font-bold text-lg text-sky-700 dark:text-sky-400">{formatMoney(settledPlannedOutflows)}</p>
              <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-0.5">Planned & Paid</p>
            </div>
            <div className="p-3 bg-indigo-50/50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/50 rounded-lg border">
              <p className="text-indigo-900 dark:text-indigo-300 text-xs mb-1 font-medium">Projected Month End</p>
              <p className="font-bold text-lg text-indigo-700 dark:text-indigo-400">{formatMoney(projectedClosing)}</p>
              <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Current Balance + Remaining Planned</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-background-elevated">
          <h2 className="font-semibold text-sm text-foreground">
            Account Balances (Actual) — {MONTHS[month - 1]} {year}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Planned items are account-agnostic and do not affect an individual account until settled.
          </p>
        </div>
        {visibleAccounts.length === 0 ? (
          <p className="p-5 text-muted text-sm">No dashboard-visible accounts. Manage visibility in Accounts.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Account</th>
                <th className="text-right px-4 py-2 font-medium">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleAccounts.map(acc => (
                <tr key={acc.id} className="hover:bg-background-elevated">
                  <td className="px-4 py-3 font-medium">{acc.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatMoney(acc.currentBalance)}
                  </td>
                </tr>
              ))}
              {visibleAccounts.length > 1 && (
                <tr className="bg-background-elevated font-semibold text-sm border-t-2">
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
      <div className="bg-background rounded-xl border shadow-sm">
        <div className="p-4 border-b bg-background-elevated flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-foreground">
              Planned Transactions — {MONTHS[month - 1]} {year}
            </h2>
            <p className="text-xs text-muted mt-0.5">Settle with account + final amount when the transaction actually happens.</p>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {allPlannedThisMonth.length} planned
          </span>
        </div>
        {allPlannedThisMonth.length === 0 ? (
          <p className="p-5 text-muted text-sm">No planned transactions for {MONTHS[month - 1]} {year}. Add one below.</p>
        ) : (
          <ul className="divide-y divide-border">
            {allPlannedThisMonth.map(tx => (
              <li key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{tx.category}</p>
                  <p className="text-xs text-muted">{tx.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-lg ${normalizeAmount(tx) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {normalizeAmount(tx) >= 0 ? '+' : ''}{formatMoney(Math.abs(normalizeAmount(tx)))}
                  </span>
                  {!tx.isPlanned ? (
                    <span className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      ✔ Complete
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => openSettle(tx)}
                        className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition active:scale-[0.99]"
                      >
                        ✔ Settle
                      </button>
                      <button
                        onClick={() => openEdit(tx)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background-elevated hover:bg-background text-foreground text-xs font-semibold transition active:scale-[0.99]"
                      >
                        ✏ Edit
                      </button>
                      <button onClick={() => setDeleteId(tx.id)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition active:scale-[0.99]">
                        🗑 Delete
                      </button>
                    </>
                  )}
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
            <div className="relative w-full max-w-lg bg-background rounded-2xl border shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base text-foreground">Settle Planned Transaction</h2>
                <button onClick={() => setSettleId(null)} className="text-sm text-muted hover:text-foreground">✕</button>
              </div>
              <p className="text-xs text-muted">Select the account and confirm final amount, category and date.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">Account</label>
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
                  <label className="text-xs text-muted font-medium">Amount</label>
                  <input
                    type="number" step="0.01"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.amount}
                    onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Final amount"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">Category</label>
                  <input
                    type="text"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.category}
                    onChange={e => setSettleForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Category"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">Actual date</label>
                  <input
                    type="date"
                    className="border rounded-lg px-3 py-2 text-sm"
                    value={settleForm.date}
                    onChange={e => setSettleForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setSettleId(null)} className="px-4 py-2 rounded-lg text-sm border border-border text-muted hover:bg-background-elevated transition active:scale-[0.99]">Cancel</button>
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

        {/* Edit modal */}
        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setEditId(null)} />
            <div className="relative w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base text-foreground">Edit Planned Transaction</h2>
                <button onClick={() => setEditId(null)} className="text-sm text-muted hover:text-foreground">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">Amount</label>
                  <input
                    type="number" step="0.01"
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">Category</label>
                  <CategorySelect
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={editForm.category}
                    onChange={v => setEditForm(f => ({ ...f, category: v }))}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs text-muted font-medium">Planned Date</label>
                  <input
                    type="date"
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={editForm.date}
                    onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg text-sm border border-border text-muted hover:bg-background-elevated transition active:scale-[0.99]">Cancel</button>
                <button
                  disabled={loading}
                  onClick={() => handleEdit(editId)}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Add planned transaction */}
      <div className="bg-background rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm mb-1 text-foreground">Add Planned Transaction</h2>
            <p className="text-xs text-muted">Plan a future income or expense without binding to an account.</p>
          </div>
          <button
            type="button"
            onClick={handleCopyPreviousMonth}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-background-elevated transition active:scale-[0.99] disabled:opacity-50"
          >
            📋 Copy Previous Month
          </button>
        </div>
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
