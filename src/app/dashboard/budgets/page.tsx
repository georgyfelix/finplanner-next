'use client';

import { useState, useEffect } from 'react';
import { CategorySelect } from '@/lib/useCategories';
import { useUserSettings } from '@/lib/useUserSettings';
import ConfirmModal from '@/app/components/ConfirmModal';

type Budget = { id: string; category: string; limit: string; month: number; year: number };

export default function BudgetsPage() {
  const now = new Date();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [form, setForm] = useState({ category: '', limit: '', month: now.getMonth() + 1, year: now.getFullYear() });
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [editId, setEditId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { formatMoney, settings } = useUserSettings();

  async function load() {
    const res = await fetch(`/api/budgets?month=${filterMonth}&year=${filterYear}`);
    setBudgets(await res.json());
  }

  useEffect(() => { load(); }, [filterMonth, filterYear]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, limit: parseFloat(form.limit) }),
    });
    if (res.ok) { setForm(f => ({ ...f, limit: '' })); await load(); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch('/api/budgets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setDeleteId(null);
    await load();
  }

  async function handleEditSave(id: string) {
    await fetch('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, limit: parseFloat(editLimit) || 0 }),
    });
    setEditId(null);
    await load();
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set monthly limits per category. Display currency: {settings?.currency ?? 'USD'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Only one budget is kept per category for a given month. Adding again updates the existing one.
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CategorySelect
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={v => setForm(f => ({ ...f, category: v }))}
          />
          <input type="number" step="0.01" placeholder="Limit" className="border rounded-lg px-3 py-2 text-sm" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} required />
          <select className="border rounded-lg px-3 py-2 text-sm" value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" placeholder="Year" className="border rounded-lg px-3 py-2 text-sm" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} required />
        </div>
        <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
          + Add / Update Budget
        </button>
      </form>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <span className="text-sm text-gray-500">Showing:</span>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="border rounded-lg px-3 py-2 text-sm w-24" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} />
      </div>

      <div className="bg-white rounded-xl border shadow-sm divide-y">
        {budgets.length === 0 ? (
          <p className="p-5 text-gray-400 text-sm">No budgets for this period.</p>
        ) : (
          budgets.map(b => (
            <div key={b.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{b.category}</p>
                <p className="text-xs text-gray-400">{MONTHS[b.month - 1]} {b.year}</p>
              </div>
              <div className="flex items-center gap-4">
                {editId === b.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      className="w-28 border rounded-lg px-2 py-1 text-sm"
                      value={editLimit}
                      onChange={e => setEditLimit(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(b.id)} className="text-xs text-indigo-600 hover:underline font-medium">Save</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-sm">{formatMoney(Number(b.limit))}</span>
                    <button onClick={() => { setEditId(b.id); setEditLimit(String(Number(b.limit))); }} className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold transition active:scale-[0.99]">✎ Edit</button>
                  </>
                )}
                <button onClick={() => setDeleteId(b.id)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition active:scale-[0.99]">🗑 Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete budget?"
        message="This will permanently remove this category budget for the selected month."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </div>
  );
}
