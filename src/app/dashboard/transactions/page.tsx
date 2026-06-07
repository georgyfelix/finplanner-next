'use client';

import { useState, useEffect } from 'react';
import { CategorySelect } from '@/lib/useCategories';
import { useUserSettings } from '@/lib/useUserSettings';
import { useCategories } from '@/lib/useCategories';
import ConfirmModal from '@/app/components/ConfirmModal';

type Account = { id: string; name: string };
type Budget = { id: string; category: string; limit: string; month: number; year: number };
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

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text) return [] as T;
  return JSON.parse(text) as T;
}

export default function TransactionsPage() {
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState({ accountId: '', amount: '', category: '', date: new Date().toISOString().slice(0, 10), isPlanned: false });
  const [settleId, setSettleId] = useState<string | null>(null);
  const [settleForm, setSettleForm] = useState({ accountId: '', amount: '', category: '', date: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ accountId: '', amount: '', category: '', date: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [copyMonths, setCopyMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { formatMoney, settings } = useUserSettings();
  const categories = useCategories();
  const categoryTypeByName = new Map(categories.map(c => [c.name, c.type]));

  function normalizeAmount(tx: Transaction) {
    const raw = Number(tx.amount);
    const type = categoryTypeByName.get(tx.category);
    if (type === 'income') return Math.abs(raw);
    if (type === 'expense' || type === 'saving') return -Math.abs(raw);
    return raw;
  }

  async function loadAll() {
    const [accRes, txRes, budgetRes] = await Promise.all([
      fetch('/api/accounts'),
      fetch(`/api/transactions?month=${month}&year=${year}`),
      fetch(`/api/budgets?month=${month}&year=${year}`),
    ]);
    const accs: Account[] = await readJsonOrThrow(accRes);
    setAccounts(accs);
    setTransactions(await readJsonOrThrow(txRes));
    setBudgets(await readJsonOrThrow(budgetRes));
    if (accs.length && !form.accountId) setForm(f => ({ ...f, accountId: accs[0].id }));
  }

  useEffect(() => { loadAll(); }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { setForm(f => ({ ...f, amount: '' })); await loadAll(); }
    else { const d = await res.json(); setError(d.error || 'Failed'); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setDeleteId(null);
    await loadAll();
  }

  async function handleCopy(id: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/transactions/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: id, numMonths: copyMonths }),
      });
      if (!res.ok) {
        const d = await readJsonOrThrow<{ error?: string }>(res);
        setError(d.error || 'Failed to copy transaction');
      } else {
        const result = await readJsonOrThrow<{ success: boolean }>(res);
        setCopyId(null);
        setCopyMonths(12);
        await loadAll();
      }
    } catch (err) {
      setError('Failed to copy transaction');
    }
    setLoading(false);
  }

  function startSettle(tx: Transaction) {
    setSettleId(tx.id);
    setSettleForm({
      accountId: tx.accountId ?? accounts[0]?.id ?? '',
      amount: String(Math.abs(normalizeAmount(tx))),
      category: tx.category,
      date: tx.date,
    });
  }

  async function handleSettle(id: string) {
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

  function startEdit(tx: Transaction) {
    setEditId(tx.id);
    setEditForm({
      accountId: tx.accountId ?? accounts[0]?.id ?? '',
      amount: String(Math.abs(normalizeAmount(tx))),
      category: tx.category,
      date: tx.date,
    });
  }

  async function handleEdit(id: string) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: editForm.accountId || null,
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: editForm.date,
      }),
    });
    setEditId(null);
    await loadAll();
  }

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? id;
  const plannedItems = transactions
    .filter(t => t.isPlanned)
    .sort((a, b) => a.date.localeCompare(b.date));
  const actualItems = transactions
    .filter(t => !t.isPlanned)
    .sort((a, b) => b.date.localeCompare(a.date));

  function fillCategoryFromBudget(category: string) {
    setForm(f => ({ ...f, category, isPlanned: false }));
  }

  return (
    <div className="space-y-6">
      <div className="bg-background rounded-xl border p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-sm text-muted mt-1">
              Add actual or planned transactions. Planned items can be settled later with final amount and account.
            </p>
            <p className="text-xs text-muted mt-1">Display currency: {settings?.currency ?? 'USD'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
            <input
              type="number"
              className="border rounded-lg px-3 py-2 text-sm w-24"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {plannedItems.length > 0 && (
        <div className="bg-background rounded-xl border shadow-sm">
          <div className="p-4 border-b bg-indigo-50 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-indigo-800">Pending Planned Items ({MONTHS[month - 1]} {year})</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {plannedItems.length} pending
            </span>
          </div>
          <ul className="divide-y">
            {plannedItems.map(tx => (
              <li key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{tx.category}</p>
                  <p className="text-xs text-muted">Planned date: {tx.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold text-sm ${normalizeAmount(tx) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {formatMoney(normalizeAmount(tx))}
                  </span>
                  <button
                    onClick={() => setCopyId(tx.id)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background-elevated hover:bg-background-elevated text-foreground text-xs font-semibold transition active:scale-[0.99]"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => startSettle(tx)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background-elevated hover:bg-background-elevated text-foreground text-xs font-semibold transition active:scale-[0.99]"
                  >
                    ✔ Settle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {budgets.length > 0 && (
        <div className="bg-background rounded-xl border shadow-sm">
          <div className="p-4 border-b bg-background-elevated">
            <h2 className="font-semibold text-sm text-foreground">Budget Categories ({MONTHS[month - 1]} {year})</h2>
            <p className="text-xs text-muted mt-0.5">Budgets are category limits, not payable items. Use a category below to log an actual transaction.</p>
          </div>
          <ul className="divide-y">
            {budgets.map(b => (
              <li key={b.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{b.category}</p>
                  <p className="text-xs text-muted">Limit: {formatMoney(Number(b.limit))}</p>
                </div>
                <button
                  onClick={() => fillCategoryFromBudget(b.category)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background-elevated hover:bg-background-elevated text-foreground text-xs font-semibold transition active:scale-[0.99]"
                >
                  ⤴ Use in form
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-background rounded-xl border p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Add Transaction</h2>
          <label className="flex items-center gap-2 text-sm col-span-1">
            <input type="checkbox" checked={form.isPlanned} onChange={e => setForm(f => ({ ...f, isPlanned: e.target.checked }))} />
            Planned
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {!form.isPlanned ? (
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={form.accountId}
              onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
              required
            >
              {accounts.length === 0 && <option value="">No accounts - create one first</option>}
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <div className="border rounded-lg px-3 py-2 text-sm text-muted bg-background-elevated">No account required for planned item</div>
          )}
          <input
            type="number" step="0.01" placeholder="Amount (sign auto-set by category)"
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
          <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          <button type="submit" disabled={loading || (!form.isPlanned && accounts.length === 0)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
            + Add
          </button>
        </div>
      </form>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="bg-background rounded-xl border shadow-sm divide-y">
        {actualItems.length === 0 ? (
          <p className="p-5 text-muted text-sm">No transactions for {MONTHS[month - 1]} {year}.</p>
        ) : (
          actualItems.map(tx => (
            <div key={tx.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{tx.category}</p>
                <p className="text-xs text-muted">
                  {tx.accountId ? accountName(tx.accountId) : 'No account'} · {tx.date}
                  {tx.origin === 'planned' && !tx.isPlanned ? ' · settled from plan' : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-semibold text-sm ${normalizeAmount(tx) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatMoney(normalizeAmount(tx))}
                </span>
                <button
                  onClick={() => startEdit(tx)}
                  className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold transition active:scale-[0.99]"
                >
                  ✎ Edit
                </button>
                <button
                  onClick={() => setDeleteId(tx.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition active:scale-[0.99]"
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setEditId(null)} />
          <div className="relative w-full max-w-lg bg-background rounded-2xl border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-foreground">Edit Transaction</h2>
              <button onClick={() => setEditId(null)} className="text-sm text-muted hover:text-foreground">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={editForm.accountId}
                onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
              >
                <option value="">No account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input
                type="number" step="0.01"
                className="border rounded-lg px-3 py-2 text-sm"
                value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Amount"
              />
              <CategorySelect
                className="border rounded-lg px-3 py-2 text-sm"
                value={editForm.category}
                onChange={v => setEditForm(f => ({ ...f, category: v }))}
              />
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm"
                value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setEditId(null)} className="px-3 py-2 rounded-lg text-sm border border-border text-muted hover:bg-background-elevated transition active:scale-[0.99]">Cancel</button>
              <button onClick={() => handleEdit(editId)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99]">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {settleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSettleId(null)}
          />
          <div className="relative w-full max-w-2xl bg-background rounded-2xl border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-foreground">Settle Planned Transaction</h2>
              <button onClick={() => setSettleId(null)} className="text-sm text-muted hover:text-foreground">Close</button>
            </div>
            <p className="text-xs text-muted">Select account and update final amount/category/date if it changed.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={settleForm.accountId}
                onChange={e => setSettleForm(f => ({ ...f, accountId: e.target.value }))}
                required
              >
                {accounts.length === 0 && <option value="">No accounts</option>}
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                className="border rounded-lg px-3 py-2 text-sm"
                value={settleForm.amount}
                onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Final amount"
              />
              <input
                type="text"
                className="border rounded-lg px-3 py-2 text-sm"
                value={settleForm.category}
                onChange={e => setSettleForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Category"
              />
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm"
                value={settleForm.date}
                onChange={e => setSettleForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setSettleId(null)} className="px-3 py-2 rounded-lg text-sm border border-border text-muted hover:bg-background-elevated transition active:scale-[0.99]">
                Cancel
              </button>
              <button onClick={() => handleSettle(settleId)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99]">
                Save Actual
              </button>
            </div>
          </div>
        </div>
      )}

      {copyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setCopyId(null)}
          />
          <div className="relative w-full max-w-md bg-background rounded-2xl border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-foreground">📋 Copy Across Months</h2>
              <button onClick={() => setCopyId(null)} className="text-sm text-muted hover:text-foreground">Close</button>
            </div>
            <p className="text-xs text-muted">Create copies of this recurring transaction for future months.</p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">How many months ahead?</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCopyMonths(Math.max(1, copyMonths - 1))}
                  className="px-2 py-1 border rounded text-sm hover:bg-background-elevated"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={copyMonths}
                  onChange={e => setCopyMonths(Math.max(1, Math.min(60, Number(e.target.value))))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm text-center"
                />
                <button
                  onClick={() => setCopyMonths(Math.min(60, copyMonths + 1))}
                  className="px-2 py-1 border rounded text-sm hover:bg-background-elevated"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-muted">Range: 1-60 months</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setCopyId(null)} className="px-3 py-2 rounded-lg text-sm border border-border text-muted hover:bg-background-elevated transition active:scale-[0.99]">Cancel</button>
              <button onClick={() => copyId && handleCopy(copyId)} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50">
                {loading ? 'Copying...' : 'Create Copies'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete transaction?"
        message="This transaction will be permanently removed."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
